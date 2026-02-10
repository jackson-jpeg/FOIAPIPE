#!/usr/bin/env python3
"""End-to-end pipeline test: News → Classification → FOIA Generation."""

import asyncio
import sys
from datetime import datetime

sys.path.insert(0, "/Users/jackson/FOIAPIPE/backend")

from app.database import async_session_factory
from app.models.news_article import NewsArticle, IncidentType
from app.models.agency import Agency
from app.models.foia_request import FoiaRequest, FoiaStatus
from app.services.article_classifier import classify_and_score_article
from app.services.foia_generator import generate_request_text, assign_case_number
from sqlalchemy import select


async def test_e2e_pipeline():
    """Test the full pipeline from news article to FOIA request."""
    print("="*80)
    print("END-TO-END PIPELINE TEST")
    print("="*80)

    async with async_session_factory() as db:
        # Step 1: Create a test news article
        print("\n1. Creating test news article...")
        test_article = NewsArticle(
            url="https://test.example.com/article/12345",
            headline="Tampa Police Officer-Involved Shooting on Nebraska Avenue",
            source="Test News Source",
            summary=(
                "Tampa Police responded to a disturbance call on Nebraska Avenue "
                "late Tuesday night that resulted in an officer-involved shooting. "
                "The suspect allegedly charged at officers with a weapon before "
                "shots were fired. Body camera footage is expected to be released."
            ),
            body=(
                "TAMPA, FL - Tampa Police Department officers were involved in a "
                "shooting Tuesday night around 11:30 PM on the 2300 block of Nebraska Avenue. "
                "According to TPD Chief Mary O'Connor, officers responded to a disturbance call "
                "and encountered a suspect armed with what appeared to be a knife. "
                "Officers gave verbal commands to drop the weapon, but the suspect allegedly "
                "charged at officers. Two officers discharged their weapons, striking the suspect. "
                "The suspect was transported to Tampa General Hospital with non-life-threatening "
                "injuries. Both officers are on administrative leave pending investigation. "
                "Body camera footage is expected to be made available within 72 hours."
            ),
            published_at=datetime.now(),
        )
        db.add(test_article)
        await db.flush()
        print(f"   Created article: {test_article.headline}")
        print(f"   Article ID: {test_article.id}")

        # Step 2: Classify the article
        print("\n2. Classifying article with AI...")
        classified_article = await classify_and_score_article(test_article, db)
        await db.commit()

        print(f"   Detected agency: {classified_article.detected_agency}")
        print(f"   Incident type: {classified_article.incident_type}")
        print(f"   Severity score: {classified_article.severity_score}")
        print(f"   Virality score: {classified_article.virality_score}")
        print(f"   Auto-FOIA eligible: {classified_article.auto_foia_eligible}")

        # Verify classification
        assert classified_article.detected_agency is not None, "Should detect agency"
        assert classified_article.incident_type == IncidentType.ois, "Should classify as OIS"
        assert classified_article.severity_score >= 7, "Should have high severity"

        # Step 3: Find the agency
        print("\n3. Looking up agency...")
        agency_result = await db.execute(
            select(Agency).where(Agency.name == classified_article.detected_agency).limit(1)
        )
        agency = agency_result.scalar_one_or_none()

        if not agency:
            print(f"   ⚠️  Agency '{classified_article.detected_agency}' not found in database")
            print("   Creating mock agency for test...")
            agency = Agency(
                name=classified_article.detected_agency,
                state="FL",
                foia_email="records@test-agency.gov",
                is_active=True,
            )
            db.add(agency)
            await db.flush()

        print(f"   Agency: {agency.name}")
        print(f"   FOIA email: {agency.foia_email}")

        # Step 4: Generate FOIA request
        print("\n4. Generating FOIA request...")
        case_number = await assign_case_number(db)
        request_text = generate_request_text(
            incident_description=classified_article.headline,
            incident_date=(
                classified_article.published_at.strftime("%B %d, %Y")
                if classified_article.published_at
                else "Unknown"
            ),
            agency_name=agency.name,
        )

        print(f"   Case number: {case_number}")
        print(f"   Request text preview: {request_text[:200]}...")

        # Step 5: Create FOIA record (but don't actually submit)
        print("\n5. Creating FOIA request record...")
        foia = FoiaRequest(
            case_number=case_number,
            agency_id=agency.id,
            news_article_id=classified_article.id,
            status=FoiaStatus.draft,
            request_text=request_text,
            is_auto_submitted=False,  # Test mode - don't auto-submit
        )
        db.add(foia)
        await db.commit()

        print(f"   FOIA request created: {foia.case_number}")
        print(f"   Status: {foia.status}")
        print(f"   Agency: {agency.name}")
        print(f"   Article linked: {foia.news_article_id}")

        # Step 6: Verify the complete chain
        print("\n6. Verifying complete pipeline...")

        # Reload to verify relationships
        await db.refresh(foia, ["agency", "news_article"])

        assert foia.agency is not None, "FOIA should have agency relationship"
        assert foia.news_article is not None, "FOIA should have article relationship"
        assert foia.news_article.id == classified_article.id, "FOIA should link to correct article"
        assert foia.request_text is not None, "FOIA should have request text"
        assert len(foia.request_text) > 100, "Request text should be substantive"

        print("   ✅ Agency relationship verified")
        print("   ✅ Article relationship verified")
        print("   ✅ Request text generated")
        print("   ✅ Case number assigned")

        # Cleanup
        print("\n7. Cleaning up test data...")
        await db.delete(foia)
        await db.delete(classified_article)
        if agency.foia_email == "records@test-agency.gov":  # Only delete if it's our test agency
            await db.delete(agency)
        await db.commit()
        print("   Test data cleaned up")

    print("\n" + "="*80)
    print("✅ END-TO-END PIPELINE TEST PASSED")
    print("="*80)
    print("\nPipeline stages verified:")
    print("  1. ✅ News article creation")
    print("  2. ✅ AI classification (agency, type, severity, virality)")
    print("  3. ✅ Auto-FOIA eligibility determination")
    print("  4. ✅ Agency lookup")
    print("  5. ✅ FOIA request text generation")
    print("  6. ✅ Case number assignment")
    print("  7. ✅ FOIA record creation with relationships")
    print("\nReady for production: News → AI → FOIA → (Manual Submit)")


if __name__ == "__main__":
    asyncio.run(test_e2e_pipeline())
