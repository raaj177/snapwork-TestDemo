// Android locators of the login screen. Tabs carry TalkBack wording ("Tab 1 of 2"). Flutter EditTexts have no
// content-desc and lose their hint once they hold a value (evidence/android/Login/fields-filled-login-enabled.xml:
// hint=""), and the password field drops password="true" while shown, so each field is found as the first EditText
// after its label View (label and field are siblings) - XPath, see the handoff Notes. It works empty, filled,
// masked and visible.
import { LoginPage } from '../common/LoginPage';
import type { ElementLocator } from '../common/BasePage';

/** The identifier label of the visible login form (Customer ID or Mobile number view). */
const LOGIN_FORM_LABEL = '//android.view.View[@content-desc="Customer ID/Trade Code" or @content-desc="Mobile number"]';

export class AndroidLoginPage extends LoginPage {
    readonly customerIdTab: ElementLocator;
    readonly mobileNoTab: ElementLocator;
    readonly customerIdInput: ElementLocator;
    readonly mobileNumberInput: ElementLocator;
    readonly passwordInput: ElementLocator;

    constructor() {
        super();
        this.customerIdTab = this.byLabel('Customer ID\nTab 1 of 2');
        this.mobileNoTab = this.byLabel('Mobile No.\nTab 2 of 2');
        this.customerIdInput = this.byXPath(
            '//android.view.View[@content-desc="Customer ID/Trade Code"]/following-sibling::android.widget.EditText[1]',
        );
        this.mobileNumberInput = this.byXPath(
            '//android.view.View[@content-desc="Mobile number"]/following-sibling::android.widget.EditText[1]',
        );
        // After Switch Account the login form is opened ON TOP of the returning-user screen, which stays in the hierarchy
        // and has its own "Password" field and Login button. Both are anchored to the login form (they follow the
        // Customer ID / Mobile number label, a sibling in the same form), so the hidden screen's controls are never used.
        this.passwordInput = this.byXPath(
            `${LOGIN_FORM_LABEL}/following-sibling::android.view.View[@content-desc="Password"][1]/following-sibling::android.widget.EditText[1]`,
        );
        (this as { loginButton: ElementLocator }).loginButton = this.byXPath(
            `${LOGIN_FORM_LABEL}/following-sibling::android.widget.Button[@content-desc="Login" or @text="Login"][1]`,
        );
    }
}
