"""Rule-based social profile comparison; it does not access social networks."""

from app.detection.similarity import combined_similarity, normalize


class SocialAgent:
    """Compare submitted profile handles with a brand's supplied official handles."""

    def detect(self, brand: dict, profiles: list[dict]) -> list[dict]:
        brand_name = str(brand.get("name", "")).strip()
        if not brand_name:
            raise ValueError("Brand name is required.")

        official_handles = [
            normalize(handle).lstrip("@")
            for handle in brand.get("official_handles", [])
            if isinstance(handle, str) and normalize(handle).lstrip("@")
        ]
        if not official_handles:
            return []

        detections: list[dict] = []
        for profile in profiles:
            raw_handle = profile.get("handle")
            if not isinstance(raw_handle, str) or not raw_handle.strip():
                continue

            handle = raw_handle.strip()
            normalized_handle = normalize(handle).lstrip("@")
            exact_match = normalized_handle in official_handles
            closest_handle, similarity = max(
                (
                    (official, combined_similarity(normalized_handle, official))
                    for official in official_handles
                ),
                key=lambda item: item[1],
            )

            # Exact official handles are always returned as context. Other
            # profiles are returned only when a comparison crosses the rule threshold.
            if not exact_match and similarity < 0.62:
                continue

            if exact_match:
                evidence = "Handle exactly matches a supplied official brand handle."
            else:
                evidence = (
                    f"Handle resembles the supplied official handle "
                    f"'{closest_handle}' (string similarity {similarity:.2f}). "
                    "This is a heuristic indicator, not proof of impersonation."
                )

            detections.append(
                {
                    "handle": handle,
                    "platform": str(profile.get("platform", "unknown")),
                    "similarity": similarity,
                    "is_official": exact_match,
                    "evidence": evidence,
                }
            )
        return detections
