"""Helper for deriving realistic synthetic sample test data based on universal data archetypes and in-document mining.
Used by extract_matrix.py and test generation workflows.
Domain-agnostic with utility/enterprise support (Smart Metering, Banking, Healthcare, E-Commerce, Logistics, SaaS).
Every non-empty test data value is formatted as: <Field Name>: <Concrete Realistic Value>.
"""
from __future__ import annotations

import re

STOPWORDS = {
    "content", "exact", "element", "notes", "type", "field", "screen",
    "description", "table", "action", "status", "given", "when", "then",
    "verify", "label", "button", "reference", "only", "example", "sample",
    "default", "shown", "shows", "displayed", "displays", "view", "section"
}


def is_non_input_scenario(text: str) -> bool:
    """Determine if a test scenario represents UI interaction, navigation, or viewing
    where no test data input is required from the user (Rule R59).
    """
    t = text.lower()

    # Rule and system checks never take user data input
    if any(k in t for k in ["verify business rule", "read-only", "static text", "banner title", "banner text", "count card", "count on the", "system value"]):
        return True

    # Explicit input indicators (field validation, data entry, selection, upload, boundary tests)
    has_input_action = any(re.search(rf"\b{p}\b", t) for p in [
        r"enter(?:s|ed|ing)?\s+(?:a|an|the|valid|invalid|\d+|new|test|sample|value|text|number|input|data|query|credentials|otp|pin|meter|mobile|serial|password|details)",
        r"type(?:s|d)?\s+(?:into|in|a|an|the|valid|invalid|\d+|value|text|number|query)",
        r"typing",
        r"input(?:s|ted|ting)?\s+(?:value|data|field|text|number)",
        r"fill(?:s|ed|ing)?\s+(?:in|up|out|field|form)",
        r"select(?:s|ed|ing)?\s+(?:from|option|value|dropdown|choice|radio|checkbox)",
        r"upload(?:s|ed|ing)?\s+(?:file|image|photo|doc|pdf)",
        r"search\s+(?:for|text|query|term)",
        r"boundary\s+limit", r"out-of-bounds", r"exceeding", r"mandatory\s+(?:field|omission|cannot)",
        r"validation\s+(?:error|prompt|rule|message)", r"special\s+character",
        r"blank\s+field", r"empty\s+field", r"invalid\s+input", r"malformed",
        r"accepts\s+valid\s+input", r"displays\s+validation\s+error"
    ])

    if has_input_action:
        return False

    # Pure interaction / display / navigation indicators
    is_interaction_or_view = any(re.search(rf"\b{w}\b", t) for w in [
        "tapped", "tap", "taps", "tapping",
        "click", "clicks", "clicked", "clicking",
        "press", "pressed", "pressing",
        "swipe", "swipes", "swiped", "swiping",
        "scroll", "scrolls", "scrolled", "scrolling",
        "back button", "back arrow", "back navigation", "device back",
        "opens", "opened", "opening",
        "shows", "shown", "displayed", "displays", "displaying",
        "not shown", "not displayed", "hidden",
        "nothing happens", "read-only", "static",
        "offline", "airplane mode", "no network", "internet connection required",
        "tag reads", "title reads", "label reads",
        "header", "banner", "footer", "icon", "logo", "dots?", "progress ring",
        "disabled", "enabled", "greyed out", "toast", "modal", "dialog", "drawer",
        "proceed", "cancel", "next", "close", "done", "skip", "get started"
    ])

    return is_interaction_or_view


def infer_ac_test_data(text: str) -> str:
    """Infer field-formatted test data for Acceptance Criteria statements.
    Returns empty string for non-input criteria (counting, sorting, layout, offline, etc.).
    Domain-agnostic with multi-industry coverage (Banking, Retail, Healthcare, Utilities, SaaS).
    """
    t = text.lower()
    if any(k in t for k in [
        "offline", "no network", "revert", "badge", "sorted", "open tab",
        "opens after", "first time", "order is", "older completed", "counts show",
        "tabs show", "screen has no items", "displayed per specification",
        "read-only", "non-editable", "disabled", "greyed out"
    ]):
        return ""

    # Universal dynamic extraction: e.g., 'enters "123" into the promo code field'
    m_direct = re.search(
        r'(?:enter|type|input|select)s?\s+["\']([^"\']{1,50})["\']\s+(?:in|into|from)?\s+(?:the\s+)?([A-Za-z0-9\s_-]{2,30}?)(?:\s+field|\s+dropdown|\s+box|\s+input|\.|$|,)',
        text,
        re.I
    )
    if m_direct:
        val = m_direct.group(1).strip()
        fld = m_direct.group(2).strip().title()
        if fld and not any(w in fld.lower() for w in ["system", "screen", "page", "app", "user"]):
            return f"{fld}: {val}"

    # Search Query
    if re.search(r"\b(?:search\s+text|typed\s+in\s+search|entered\s+in\s+search|search\s+query|search\s+bar)\b", t):
        m_q = re.search(r"[\"']([^\"'\n\r]{1,20})[\"']", t)
        q_val = m_q.group(1) if m_q else "10023485"
        return f"Search Query: {q_val}"

    # Financial / Banking
    if re.search(r"\b(?:amount|transfer\s+amount|payment\s+amount|deposit|withdraw)\b", t) and any(k in t for k in ["enter", "type", "pay", "send", "input"]):
        m_amt = re.search(r"[\$₹€£]?\s*(\d+(?:\.\d{1,2})?)", t)
        amt_val = m_amt.group(1) if m_amt else "250.00"
        return f"Amount: {amt_val}"

    if re.search(r"\b(?:account\s+number|beneficiary\s+account|iban)\b", t) and any(k in t for k in ["enter", "type", "input"]):
        return "Account Number: 10029384756"

    if re.search(r"\b(?:card\s+number|credit\s+card|debit\s+card)\b", t) and any(k in t for k in ["enter", "type", "input"]):
        return "Card Number: 4111222233334444"

    # E-Commerce / Retail
    if re.search(r"\b(?:promo\s+code|coupon\s+code|voucher)\b", t) and any(k in t for k in ["enter", "apply", "type", "input"]):
        return "Promo Code: SAVE20"

    # Utilities / Smart Metering
    if re.search(r"\bzone\b", t) and any(k in t for k in ["select", "change", "choose"]):
        return "Zone: South Zone"

    if re.search(r"\bsection\b", t) and any(k in t for k in ["select", "change", "choose"]):
        return "Section: Bandra Section"

    if re.search(r"\b(?:neighbouring\s+ca|ca\s+number)\b", t) and any(k in t for k in ["enter", "type", "digits", "lookup"]):
        return "Neighbouring CA: 10029384756"

    if re.search(r"\bmeter(?:\s+number)?\b", t) and any(k in t for k in ["enter", "type", "input"]):
        return "New Meter Number: 8847291042"

    # General User / Contact
    if re.search(r"\b(?:email|email\s+address)\b", t) and any(k in t for k in ["enter", "type", "input"]):
        return "Email Address: alex.test@example.com"

    if re.search(r"\b(?:mobile|phone)\b", t) and any(k in t for k in ["enter", "type"]):
        return "Mobile Number: 9876543210"

    if re.search(r"\b(?:customer|consumer|patient|user)\s+name\b", t) and any(k in t for k in ["enter", "type"]):
        return "Customer Name: Charlie Joseph"

    if re.search(r"\bpassword\b", t) and any(k in t for k in ["enter", "type", "input"]):
        return "Password: Adhi@23435g"

    return ""


def derive_clean_test_data(
    field_name: str,
    typ: str = "Positive",
    error_msg: str = "",
    fmt_rule: str = "",
    val_rule: str = ""
) -> str:
    """Derive realistic, domain-specific sample test data strictly formatted as:
    `<Field Name>: <Concrete Realistic Value>`.
    Eliminates all improper fallbacks (ID-908234, 000000, 123, Valid input value).
    """
    fn = field_name.strip()
    if not fn:
        return ""

    # Clean field name for prefix display
    display_field = re.sub(r'^(?:S\d+(?:–S\d+)?(?:\s*\([^)]*\))?\s*[-–:]\s*|Screen\s*\d+\s*[-–:]\s*|Tile:\s*|Button:\s*)', '', fn).strip()
    display_field = re.sub(r'\s*\((?:hidden|per\s+row|per\s+question|per\s+material|per\s+accessory|per\s+slot|list\s+item|office\s+item)\)', '', display_field).strip()

    if not display_field:
        return ""

    fn_low = display_field.lower()
    em_low = f"{error_msg} {val_rule} {fmt_rule}".lower()

    # 1. Email
    if "email" in fn_low:
        val = "alex.engineer@example.com" if typ == "Positive" else "user@invalid-domain"
        return f"{display_field}: {val}"

    # 2. Mobile / Phone / Contact
    if any(k in fn_low for k in ["mobile", "phone", "contact", "msisdn"]):
        if typ == "Positive":
            val = "9876543210"
        elif any(k in em_low for k in ["digit", "short", "length", "10"]):
            val = "98765"
        else:
            val = "98765ABCDE"
        return f"{display_field}: {val}"

    # 3. Currency / Amount / Price / Balance / Fee / Salary / Transfer / Payment
    if any(k in fn_low for k in ["amount", "price", "balance", "fee", "salary", "transfer", "payment", "cost", "total"]):
        if typ == "Positive":
            val = "$250.00" if "$" in em_low else "250.00"
        elif any(k in em_low for k in ["negative", "below", "min", "greater than 0", "positive"]):
            val = "-50.00"
        else:
            val = "INVALID_AMT"
        return f"{display_field}: {val}"

    # 4. Card / Credit Card / Debit Card Number
    if any(k in fn_low for k in ["card number", "credit card", "debit card", "card_no"]):
        val = "4111222233334444" if typ == "Positive" else "411122223333"
        return f"{display_field}: {val}"

    # 5. Account Number / IBAN / Routing Number / Beneficiary
    if any(k in fn_low for k in ["account number", "account no", "iban", "routing", "beneficiary account"]):
        val = "10029384756" if typ == "Positive" else "100293847AB"
        return f"{display_field}: {val}"

    # 6. CA / Consumer Account / Neighbouring CA (Utility & General)
    if any(k in fn_low for k in ["neighbouring ca", "ca number", "consumer account"]) or fn_low == "ca":
        if typ == "Positive":
            val = "10029384756"
        elif any(k in em_low for k in ["11", "digit", "short", "valid 11"]):
            val = "12345"
        else:
            val = "100293847AB"
        return f"{display_field}: {val}"

    # 7. Tax ID / SSN / PAN / National ID
    if any(k in fn_low for k in ["tax id", "ssn", "pan", "national id", "ein"]):
        val = "ABCDE1234F" if typ == "Positive" else "INVALID_ID#"
        return f"{display_field}: {val}"

    # 8. Order / Transaction / Invoice / Tracking Number
    if any(k in fn_low for k in ["order id", "order number", "transaction id", "invoice", "tracking number"]):
        val = "ORD-9018241" if typ == "Positive" else "ORD@INVALID"
        return f"{display_field}: {val}"

    # 9. Postal Code / Zip Code
    if any(k in fn_low for k in ["zip", "postal code", "pincode", "pin code"]):
        val = "400001" if typ == "Positive" else "0000000"
        return f"{display_field}: {val}"

    # 10. Address / Street / City / State / Country
    if any(k in fn_low for k in ["street", "address", "city", "state", "country"]):
        val = "123 Main Street, Suite 400" if typ == "Positive" else "Invalid Address !@#$"
        return f"{display_field}: {val}"

    # 11. URL / Website / Webhook / Endpoint
    if any(k in fn_low for k in ["url", "website", "webhook", "endpoint", "link"]):
        val = "https://example.com/api/v1" if typ == "Positive" else "invalid-url-string"
        return f"{display_field}: {val}"

    # 12. Meter Number
    if "meter" in fn_low and any(k in fn_low for k in ["number", "no", "serial", "mismatch"]):
        if "old" in fn_low:
            val = "MTR-7720194" if typ == "Positive" else "MTR@#$%"
        else:
            val = "8847291042" if typ == "Positive" else ("MTR@#$%" if any(k in em_low for k in ["format", "special", "char"]) else "99887")
        return f"{display_field}: {val}"

    # 13. Seal Number / Position
    if "seal" in fn_low and any(k in fn_low for k in ["number", "no", "pos", "id", "detail"]):
        val = "SL-409182" if typ == "Positive" else "SL@#$%"
        return f"{display_field}: {val}"

    # 14. Consumer / Customer / Patient / User Name
    if any(k in fn_low for k in ["consumer name", "customer name", "patient name", "user name", "username", "customer - name"]) or (fn_low == "name" and "profile" not in fn_low and "office" not in fn_low):
        val = "Charlie Joseph" if typ == "Positive" else "Charlie@123_#$%"
        return f"{display_field}: {val}"

    # 15. Complaint / UPAN
    if any(k in fn_low for k in ["upan", "complaint"]):
        val = "UPAN-9018241" if typ == "Positive" else "UPAN@INVALID"
        return f"{display_field}: {val}"

    # 16. Pole Number
    if "pole" in fn_low:
        val = "POL-99281" if typ == "Positive" else "POL@INVALID#"
        return f"{display_field}: {val}"

    # 17. Search
    if "search" in fn_low:
        val = "10023485" if typ == "Positive" else ("AB" if any(k in em_low for k in ["3", "fewer", "short", "min"]) else "!@#$%^&*")
        return f"{display_field}: {val}"

    # 18. Date
    if "date" in fn_low:
        val = "18-12-2025" if typ == "Positive" else "32-13-2025"
        return f"{display_field}: {val}"

    # 19. Reading / Consumption
    if any(k in fn_low for k in ["reading", "kwh", "consumption"]):
        val = "1042.5" if typ == "Positive" else "-50.0"
        return f"{display_field}: {val}"

    # 20. GPS Coordinates / Lat Long
    if re.search(r"\b(?:lat(?:itude)?|long(?:itude)?|gps|coordinates?)\b", fn_low):
        val = "19.0760, 72.8777" if typ == "Positive" else "999.000, 999.000"
        return f"{display_field}: {val}"

    # 21. Customer Relationship
    if "relationship" in fn_low:
        val = "Father" if typ == "Positive" else "INVALID_RELATION"
        return f"{display_field}: {val}"

    # 22. Quantity
    if re.search(r"\b(?:quantity|qty)\b", fn_low):
        val = "5" if typ == "Positive" else ("10000" if any(k in em_low for k in ["above", "max", "9999"]) else "-1")
        return f"{display_field}: {val}"

    # 23. Zone / Section / Master Dropdowns
    if "zone" in fn_low:
        val = "South Zone" if typ == "Positive" else "INVALID_ZONE"
        return f"{display_field}: {val}"
    if "section" in fn_low:
        val = "Bandra Section" if typ == "Positive" else "INVALID_SECTION"
        return f"{display_field}: {val}"

    # 24. Dropdown Reasons (Cancel, Hold, Meter Change)
    if "reason" in fn_low:
        val = "Consumer Refusal" if any(k in fn_low for k in ["cancel", "hold"]) else "Faulty Meter Display"
        if typ != "Positive":
            val = "INVALID_REASON"
        return f"{display_field}: {val}"

    # 25. Tabs
    if "tab" in fn_low:
        val = "METER_INSTALL" if "case" in fn_low else "Pending"
        return f"{display_field}: {val}"

    # 26. Photo / File Upload
    if any(k in fn_low for k in ["photo", "image", "picture", "file", "document"]):
        val = "sample_document.pdf (1.5 MB)" if typ == "Positive" else "oversized_file_50mb.pdf"
        return f"{display_field}: {val}"

    # 27. Signature
    if "sign" in fn_low:
        val = "Captured digital stroke on canvas" if typ == "Positive" else "[No stroke drawn]"
        return f"{display_field}: {val}"

    # 28. Notes / Remarks / Feedback
    if any(k in fn_low for k in ["remark", "feedback", "comment", "note"]):
        val = "Operation completed as per standard procedure" if typ == "Positive" else ""
        return f"{display_field}: {val}" if val else ""

    # 29. Meter Reading Note (Old Reading - MR Note)
    if "mr note" in fn_low:
        val = "Glass Broken" if typ == "Positive" else "INVALID_NOTE"
        return f"{display_field}: {val}"

    # 30. Test Report Number
    if "test report" in fn_low:
        val = "TR-9823410" if typ == "Positive" else "TR@#$"
        return f"{display_field}: {val}"

    # 31. Password
    if "password" in fn_low:
        val = "Adhi@23435g" if typ == "Positive" else "PlainPassword123"
        return f"{display_field}: {val}"

    # 22. OTP / PIN / Passcode
    if any(k in fn_low for k in ["otp", "pin", "cvv", "passcode"]):
        val = "123456" if typ == "Positive" else "12"
        return f"{display_field}: {val}"

    # 23. Boundary digits or character constraints
    m_dig = re.search(r'(\d+)\s*digits?', fmt_rule + " " + val_rule, re.I)
    if m_dig:
        n = int(m_dig.group(1))
        val = ("9" * n) if typ == "Positive" else ("9" * max(1, n // 2))
        return f"{display_field}: {val}"

    m_char = re.search(r'(\d+)\s*characters?', fmt_rule + " " + val_rule, re.I)
    if m_char:
        n = int(m_char.group(1))
        val = ("ValidText"[:n]) if typ == "Positive" else ("A" * (n + 5))
        return f"{display_field}: {val}"

    # 24. Clean Generic Domain Fallback (Always formatted with field name, never raw numbers)
    clean_val = display_field.replace(" ", "_")
    val = f"Valid_{clean_val}" if typ == "Positive" else f"Invalid_{clean_val}"
    return f"{display_field}: {val}"


def derive_domain_sample(field_or_text: str, typ: str = "Positive", error_msg: str = "") -> str:
    """Wrapper adhering to the field-prefixed standard."""
    return derive_clean_test_data(field_or_text, typ=typ, error_msg=error_msg)


def infer_sample_test_data(
    field_name: str = "",
    val_cell: str = "",
    desc_cell: str = "",
    error_msg: str = "",
    typ: str = "Positive",
    scn_title: str = "",
    full_text: str = ""
) -> str:
    """Derive realistic sample test data strictly formatted as <Field Name>: <Value>.
    For non-input scenarios (viewing, layout, navigation, system rules), returns empty string.
    """
    raw_comb = f"{field_name} {val_cell} {desc_cell} {error_msg} {scn_title}".lower()

    if is_non_input_scenario(raw_comb):
        return ""

    clean_fn = field_name.strip()
    if not clean_fn or any(clean_fn.lower().startswith(p) for p in ["verify", "given", "when", "then"]) or len(clean_fn) > 35:
        return infer_ac_test_data(scn_title or field_name or desc_cell)

    return derive_clean_test_data(clean_fn, typ=typ, error_msg=error_msg, val_rule=val_cell)
