// Android locators of the login screen. Tabs carry TalkBack wording ("Tab 1 of 2"). Flutter EditTexts have no
// content-desc and lose their hint once they hold a value (evidence/android/Login/fields-filled-login-enabled.xml:
// hint=""), and the password field drops password="true" while shown, so each field is found as the first EditText
// after its label View (label and field are siblings) - XPath, see the handoff Notes. It works empty, filled,
// masked and visible.
import { LoginPage } from '../common/LoginPage';
import type { ElementLocator } from '../common/BasePage';

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
        this.passwordInput = this.byXPath('//android.view.View[@content-desc="Password"]/following-sibling::android.widget.EditText[1]');
    }
}
