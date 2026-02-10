#!/usr/bin/env python3
"""Test email credentials (SMTP and IMAP) with iCloud.

This script helps verify your email configuration is correct before deployment.
Run this manually with your iCloud credentials configured.
"""

import asyncio
import sys
from datetime import datetime

sys.path.insert(0, "/Users/jackson/FOIAPIPE/backend")

from app.config import settings


async def test_smtp():
    """Test SMTP (outgoing email) connection."""
    print("\n" + "="*80)
    print("TESTING SMTP (Outgoing Email)")
    print("="*80)

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print("❌ SMTP not configured. Set these environment variables:")
        print("   SMTP_HOST=smtp.mail.me.com")
        print("   SMTP_PORT=587")
        print("   SMTP_USER=recordsrequest@foiaarchive.com")
        print("   SMTP_PASSWORD=<app-specific password>")
        print("   FROM_EMAIL=recordsrequest@foiaarchive.com")
        return False

    print(f"SMTP Host: {settings.SMTP_HOST}")
    print(f"SMTP Port: {settings.SMTP_PORT}")
    print(f"SMTP User: {settings.SMTP_USER}")
    print(f"From Email: {settings.FROM_EMAIL}")

    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        # Create test message
        msg = MIMEMultipart()
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = settings.SMTP_USER  # Send to self for testing
        msg["Subject"] = f"FOIAPIPE Test Email - {datetime.now().isoformat()}"

        body = """This is a test email from FOIAPIPE.

If you receive this, your SMTP configuration is working correctly!

Test Details:
- Host: {host}
- Port: {port}
- Time: {time}

You can safely delete this email.
""".format(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            time=datetime.now().isoformat(),
        )

        msg.attach(MIMEText(body, "plain"))

        # Send email
        print("\nAttempting to send test email...")
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,
            start_tls=settings.SMTP_PORT == 587,
        )

        print("✅ SMTP TEST PASSED")
        print(f"   Test email sent to: {settings.SMTP_USER}")
        print("   Check your inbox to verify receipt!")
        return True

    except Exception as e:
        print(f"❌ SMTP TEST FAILED: {e}")
        print("\nTroubleshooting:")
        print("1. Verify app-specific password is correct")
        print("2. Check iCloud Mail settings allow SMTP")
        print("3. Ensure 2FA is enabled on your Apple ID")
        print("4. Generate a new app-specific password at: https://appleid.apple.com")
        return False


async def test_imap():
    """Test IMAP (incoming email) connection."""
    print("\n" + "="*80)
    print("TESTING IMAP (Incoming Email)")
    print("="*80)

    if not settings.IMAP_HOST or not settings.IMAP_USER:
        print("❌ IMAP not configured. Set these environment variables:")
        print("   IMAP_HOST=imap.mail.me.com")
        print("   IMAP_PORT=993")
        print("   IMAP_USER=recordsrequest@foiaarchive.com")
        print("   IMAP_PASSWORD=<app-specific password>")
        return False

    print(f"IMAP Host: {settings.IMAP_HOST}")
    print(f"IMAP Port: {settings.IMAP_PORT}")
    print(f"IMAP User: {settings.IMAP_USER}")

    try:
        import aioimaplib

        # Connect to IMAP server
        print("\nConnecting to IMAP server...")
        imap = aioimaplib.IMAP4_SSL(
            host=settings.IMAP_HOST,
            port=settings.IMAP_PORT,
        )

        # Login
        print("Logging in...")
        await imap.wait_hello_from_server()
        await imap.login(settings.IMAP_USER, settings.IMAP_PASSWORD)

        print("✅ IMAP login successful")

        # Select inbox
        await imap.select("INBOX")
        print("✅ INBOX selected")

        # Check for recent messages
        response = await imap.search("ALL")
        message_ids = response.lines[0].split()
        message_count = len(message_ids)

        print(f"✅ Found {message_count} total messages in inbox")

        # Check for unread messages
        response = await imap.search("UNSEEN")
        unread_ids = response.lines[0].split() if response.lines[0] else []
        unread_count = len(unread_ids)

        print(f"✅ {unread_count} unread messages")

        # Logout
        await imap.logout()

        print("\n✅ IMAP TEST PASSED")
        print("   Successfully connected and read inbox")
        return True

    except Exception as e:
        print(f"❌ IMAP TEST FAILED: {e}")
        print("\nTroubleshooting:")
        print("1. Verify app-specific password is correct")
        print("2. Check iCloud Mail settings allow IMAP")
        print("3. Ensure 2FA is enabled on your Apple ID")
        print("4. Try logging into webmail to verify account works")
        return False


async def test_email_monitoring():
    """Test the email monitoring service."""
    print("\n" + "="*80)
    print("TESTING EMAIL MONITORING SERVICE")
    print("="*80)

    try:
        from app.services.email_monitor import check_inbox

        print("Checking inbox for FOIA responses...")
        responses = await check_inbox()

        if responses:
            print(f"✅ Found {len(responses)} email(s)")
            for i, resp in enumerate(responses, 1):
                print(f"\n  Email {i}:")
                print(f"    From: {resp.get('from')}")
                print(f"    Subject: {resp.get('subject')}")
                print(f"    Date: {resp.get('date')}")
                print(f"    Case Number: {resp.get('case_number', 'N/A')}")
        else:
            print("✅ Inbox check successful (no FOIA responses found)")

        return True

    except Exception as e:
        print(f"❌ EMAIL MONITORING TEST FAILED: {e}")
        return False


async def main():
    """Run all email tests."""
    print("="*80)
    print("FOIAPIPE EMAIL CREDENTIALS TEST")
    print(f"Started: {datetime.now().isoformat()}")
    print("="*80)

    results = {
        "smtp": await test_smtp(),
        "imap": await test_imap(),
    }

    # Only test monitoring if both SMTP and IMAP work
    if results["smtp"] and results["imap"]:
        results["monitoring"] = await test_email_monitoring()
    else:
        results["monitoring"] = False

    # Final summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    print(f"SMTP (Outgoing):     {'✅ PASS' if results['smtp'] else '❌ FAIL'}")
    print(f"IMAP (Incoming):     {'✅ PASS' if results['imap'] else '❌ FAIL'}")
    print(f"Email Monitoring:    {'✅ PASS' if results['monitoring'] else '❌ FAIL'}")

    all_passed = all(results.values())

    if all_passed:
        print("\n🎉 ALL TESTS PASSED - Email configuration is ready for production!")
        print("\nNext steps:")
        print("1. Deploy to Railway")
        print("2. Set same email environment variables in Railway")
        print("3. Test FOIA submission from production")
    else:
        print("\n⚠️  SOME TESTS FAILED - Fix issues before deployment")
        print("\nTroubleshooting guide:")
        print("1. Generate app-specific password: https://appleid.apple.com")
        print("2. Enable 2FA on your Apple ID if not already enabled")
        print("3. Verify custom domain email is set up in iCloud")
        print("4. Check iCloud Mail settings allow IMAP/SMTP")

    print("\n" + "="*80)

    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
