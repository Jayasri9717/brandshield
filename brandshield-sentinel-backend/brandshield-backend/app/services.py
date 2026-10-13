"""Transparent, deterministic checks over data explicitly submitted to the API."""

import ipaddress
import unicodedata
from urllib.parse import urlsplit

from app.detection.similarity import combined_similarity, normalize


RISK_LEVELS = (
    (75.0, "high"),
    (40.0, "medium"),
    (0.0, "low"),
)

SUSPICIOUS_PERMISSION_WEIGHTS = {
    "SEND_SMS": 45,
    "RECEIVE_SMS": 35,
    "READ_SMS": 30,
    "REQUEST_INSTALL_PACKAGES": 20,
    "SYSTEM_ALERT_WINDOW": 18,
    "BIND_ACCESSIBILITY_SERVICE": 25,
    "READ_CONTACTS": 8,
    "READ_CALL_LOG": 15,
    "RECORD_AUDIO": 8,
}


def risk_level(score: float) -> str:
    for threshold, level in RISK_LEVELS:
        if score >= threshold:
            return level
    return "low"


def app_metadata_risk(permissions: list[str]) -> tuple[float, list[str]]:
    """Score selected permission names; this does not inspect an APK binary."""
    findings: list[str] = []
    score = 0
    for permission in permissions:
        cleaned = permission.strip()
        normalized = cleaned.rsplit(".", 1)[-1].upper()
        weight = SUSPICIOUS_PERMISSION_WEIGHTS.get(normalized)
        if weight is not None:
            score += weight
            findings.append(f"Submitted permission '{cleaned}' can be sensitive (rule weight {weight}).")

    if not findings:
        findings.append(
            "No permission from this endpoint's small sensitive-permission list was supplied; "
            "this is not a malware verdict."
        )
    else:
        findings.append(
            "Score uses only the submitted permission names; the APK file itself was not scanned."
        )
    return float(min(score, 100)), findings


def _host_from_input(value: str) -> str:
    candidate = value.strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlsplit(candidate)
    host = (parsed.hostname or "").rstrip(".").casefold()
    if not host or " " in host or len(host) > 253:
        raise ValueError("Enter a valid domain or URL.")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("IP addresses are not accepted; submit a domain name.")
    return host


def _core_domain(host: str) -> str:
    labels = host.split(".")
    if len(labels) < 2:
        return labels[0]
    return labels[-2]


def _contains_mixed_scripts(value: str) -> bool:
    scripts: set[str] = set()
    for character in value:
        if not character.isalpha():
            continue
        name = unicodedata.name(character, "").upper()
        if "LATIN" in name:
            scripts.add("latin")
        elif "CYRILLIC" in name:
            scripts.add("cyrillic")
        elif "GREEK" in name:
            scripts.add("greek")
        else:
            scripts.add("other")
    return len(scripts) > 1


def domain_risk(candidate: str, official_domains: list[str]) -> tuple[float, list[str], str]:
    """Compare a submitted host to supplied official domains with string rules."""
    host = _host_from_input(candidate)
    normalized_official = [_host_from_input(domain) for domain in official_domains if domain.strip()]
    if not normalized_official:
        raise ValueError("Add at least one official domain to the brand profile first.")

    for official in normalized_official:
        if host == official or host.endswith(f".{official}"):
            return 0.0, [f"Host matches the supplied official domain '{official}'."], host

    if _contains_mixed_scripts(host) or "xn--" in host:
        return (
            95.0,
            ["Domain uses mixed writing systems or punycode, which can conceal lookalike characters."],
            host,
        )

    best_domain = ""
    best_score = 0.0
    for official in normalized_official:
        score = combined_similarity(_core_domain(host), _core_domain(official))
        if score > best_score:
            best_score, best_domain = score, official

    if best_score >= 0.58:
        score = min(90.0, round(best_score * 100))
        findings = [
            f"Domain label resembles the supplied official domain '{best_domain}' "
            f"(string similarity {best_score:.2f}).",
            "Similarity is a triage signal only; verify ownership and DNS before taking action.",
        ]
        return score, findings, host

    return (
        5.0,
        ["No strong string match was found against the supplied official domains."],
        host,
    )
