// Android locator of the returning-user password field (Flutter EditText without content-desc): XPath on the
// password attribute, see the handoff Notes.
import { ReturningLoginPage } from '../common/ReturningLoginPage';
import type { ElementLocator } from '../common/BasePage';

export class AndroidReturningLoginPage extends ReturningLoginPage {
    readonly passwordInput: ElementLocator;

    constructor() {
        super();
        this.passwordInput = this.byXPath('//android.widget.EditText[@password="true"]');
    }
}
