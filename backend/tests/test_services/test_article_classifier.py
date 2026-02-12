"""Tests for article classification, scoring, and agency detection."""

import pytest

from app.services.article_classifier import (
    classify_incident,
    detect_agency,
    score_severity,
    assess_auto_foia_eligibility,
)


class TestClassifyIncident:
    def test_ois_from_headline(self):
        assert classify_incident("Officer-involved shooting in Tampa") == "ois"

    def test_use_of_force(self):
        assert classify_incident("Video shows officer punching suspect") == "use_of_force"

    def test_pursuit(self):
        assert classify_incident("High-speed chase ends in crash") == "pursuit"

    def test_taser(self):
        assert classify_incident("Deputy tased man during traffic stop") == "taser"

    def test_k9(self):
        assert classify_incident("K-9 unit deployed during search") == "k9"

    def test_arrest(self):
        assert classify_incident("Man arrested after robbery") == "arrest"

    def test_dui(self):
        assert classify_incident("DUI suspect crashes into pole") == "dui"

    def test_other_for_unrelated(self):
        assert classify_incident("City council approves new budget") == "other"

    def test_priority_order_ois_over_arrest(self):
        # OIS should take priority even if "arrest" also appears
        assert classify_incident("Officer-involved shooting after arrest attempt") == "ois"

    def test_body_text_used(self):
        result = classify_incident("Breaking news", body="Shots fired during confrontation")
        assert result == "ois"


class TestDetectAgency:
    def test_tampa_police(self):
        assert detect_agency("Tampa Police responded to the scene") == "Tampa Police Department"

    def test_hcso(self):
        assert detect_agency("HCSO deputies arrived") == "Hillsborough County Sheriff's Office"

    def test_st_pete_police(self):
        assert detect_agency("St. Petersburg Police are investigating") == "St. Petersburg Police Department"

    def test_pcso(self):
        assert detect_agency("PCSO released a statement") == "Pinellas County Sheriff's Office"

    def test_fhp(self):
        assert detect_agency("Florida Highway Patrol is on scene") == "Florida Highway Patrol"

    def test_no_agency(self):
        assert detect_agency("A man was found at the park") is None

    def test_case_insensitive(self):
        assert detect_agency("tpd officers were called") == "Tampa Police Department"


class TestScoreSeverity:
    def test_ois_base_score(self):
        assert score_severity("ois", "officer-involved shooting") == 9

    def test_fatal_ois_boosts_score(self):
        score = score_severity("ois", "fatal officer-involved shooting, suspect killed")
        assert score == 10  # 9 base + 2 for fatal, capped at 10

    def test_arrest_low_score(self):
        assert score_severity("arrest", "man arrested") == 3

    def test_bodycam_mention_boosts(self):
        base = score_severity("arrest", "man arrested")
        boosted = score_severity("arrest", "man arrested, bodycam footage released")
        assert boosted == base + 1

    def test_score_capped_at_10(self):
        # Stack all modifiers on a high-base incident
        score = score_severity(
            "ois",
            "fatal officer-involved shooting, officer identified, "
            "multiple officers involved, bodycam footage, internal affairs complaint"
        )
        assert score == 10

    def test_other_has_low_score(self):
        assert score_severity("other", "nothing notable") == 2


class TestAutoFoiaEligibility:
    def test_eligible_high_severity(self):
        assert assess_auto_foia_eligibility(8, True, True) is True

    def test_ineligible_low_severity(self):
        assert assess_auto_foia_eligibility(3, True, True) is False

    def test_ineligible_no_email(self):
        assert assess_auto_foia_eligibility(8, False, True) is False

    def test_ineligible_inactive_agency(self):
        assert assess_auto_foia_eligibility(8, True, False) is False

    def test_threshold_boundary(self):
        assert assess_auto_foia_eligibility(7, True, True) is True
        assert assess_auto_foia_eligibility(6, True, True) is False
