import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from extract_matrix import (  # noqa: E402
    classify_field_control,
    extract_quoted_error_messages,
    generate_dynamic_test_data_requirements,
    parse_document_matrix,
    redact_contact_details,
)


class ExtractMatrixTests(unittest.TestCase):
    def test_control_classification_separates_inputs_actions_and_displays(self):
        self.assertEqual(classify_field_control("Customer ID", "Text", "Customer ID input"), "input")
        self.assertEqual(classify_field_control("Continue button", "Button", "Continue action"), "action")
        self.assertEqual(classify_field_control("Login heading", "UI Display", "Static heading"), "display")
        self.assertEqual(classify_field_control("Automatic prompt", "System Event", "Triggered by login"), "action")

    def test_only_explicitly_identified_error_messages_are_extracted(self):
        self.assertEqual(
            extract_quoted_error_messages('Error: "Invalid customer ID". Button text: "Continue".'),
            ["Invalid customer ID"],
        )

    def test_source_contact_examples_are_redacted(self):
        text = redact_contact_details(
            'Message sent to xxxxxxxx23, qa@example.com, 111 111 1111, and "Alex Sample VYD083"'
        )
        self.assertEqual(
            text,
            'Message sent to registered mobile number, registered email address, support contact number, and "account details withheld"',
        )

    def test_matrix_does_not_treat_controls_as_input_fields(self):
        source = """# US-001. Login
## Acceptance Criteria
- The user can open the Login screen.
## Field Validations & Error Messages
| Field / Element | Description | Data Type | Mandatory | Validations & Error Messages |
|---|---|---|---|---|
| Continue Button | Opens the dashboard after successful login. | Button | Yes | On tap: open the dashboard. |
| Login Heading | Static label at the top of the screen. | UI Display | Yes | Static label. |
| Customer ID Field | Registered customer identifier. | Text | Yes | Error: "Enter a valid customer ID". |
"""
        matrix = parse_document_matrix(source, platform="Both Android and iOS")
        cases = matrix["modules"][0]["cases"]

        button_cases = [case for case in cases if "Continue Button" in case["scenario"]]
        self.assertEqual(len(button_cases), 1)
        self.assertEqual(button_cases[0]["category"], "Functional")
        self.assertEqual(button_cases[0]["test_data"], "")
        self.assertNotIn("valid input", button_cases[0]["scenario"].lower())

        heading_cases = [case for case in cases if "Login Heading" in case["scenario"]]
        self.assertEqual(len(heading_cases), 1)
        self.assertEqual(heading_cases[0]["category"], "UI")

        input_cases = [case for case in cases if "Customer ID Field" in case["scenario"]]
        self.assertEqual(len(input_cases), 2)
        self.assertTrue(all(case["category"] == "Field Validation" for case in input_cases))
        self.assertTrue(all("secure QA fixture" in case["test_data"] for case in input_cases))

        self.assertTrue(all("not signed in" in case["precondition"].lower() for case in cases))
        self.assertEqual(len(matrix["test_data_requirements"]), 1)
        self.assertTrue(matrix["acs"])
        self.assertTrue(all(ac_id.startswith("WAC-US001-") for ac_id in matrix["acs"]))

    def test_inline_acceptance_criteria_receive_working_ids(self):
        source = """# US-002. Login
## User Story & Acceptance Criteria
Feature: FEAT-1 As a user I want to sign in so that I can view my account. Acceptance Criteria - The login form is visible. - Tapping Continue opens the two-factor screen. - The app returns to the login form after logout.
"""
        matrix = parse_document_matrix(source)
        cases = matrix["modules"][0]["cases"]

        self.assertEqual(len(cases), 3)
        self.assertEqual(len(matrix["acs"]), 3)
        self.assertTrue(all(case["requirement_reference"].split("|")[1].strip().startswith("WAC-US002-") for case in cases))

    def test_mobile_login_uses_secure_fixture_instead_of_a_phone_number(self):
        source = """# US-003. Mobile Login
## Field Validations & Error Messages
| Field / Element | Description | Data Type | Mandatory | Validations & Error Messages |
|---|---|---|---|---|
| Mobile Number Field | Registered mobile number. | Numeric | Yes | Enter a 10-digit number beginning with 6, 7, 8, or 9. |
"""
        matrix = parse_document_matrix(source)
        case = next(
            case for case in matrix["modules"][0]["cases"]
            if "accepts valid input" in case["scenario"].lower()
        )

        self.assertIn("controlled QA fixture", case["test_data"])
        self.assertNotRegex(case["test_data"], r"\b\d{10}\b")
        self.assertEqual(len(matrix["test_data_requirements"]), 1)
        self.assertEqual(matrix["test_data_requirements"][0]["status"], "Not Prepared")

    def test_only_explicit_test_data_prerequisites_are_collected(self):
        modules = [{
            "label": "US-001. Login",
            "cases": [{
                "user_story_id": "US-001",
                "case_id": "TC_US001_001",
                "module": "US-001. Login",
                "requirement_reference": "US-001 | WAC-US001-001",
                "test_data_requirements": {
                    "description": "A controlled test account with an expired password",
                    "notes": "Provision only in the isolated test environment.",
                },
            }],
        }]

        requirements = generate_dynamic_test_data_requirements(modules, "Mobile App")
        self.assertEqual(len(requirements), 1)
        self.assertEqual(requirements[0]["status"], "Not Prepared")
        self.assertEqual(requirements[0]["user_story_id"], "US-001")
        self.assertEqual(requirements[0]["requirement_reference"], "US-001 | WAC-US001-001")


if __name__ == "__main__":
    unittest.main()
