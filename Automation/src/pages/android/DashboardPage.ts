// Android bottom tab bar: TalkBack wording in the content description.
import { DashboardPage } from '../common/DashboardPage';
import type { ElementLocator } from '../common/BasePage';

export class AndroidDashboardPage extends DashboardPage {
    readonly dashboardTab: ElementLocator;
    readonly moreTab: ElementLocator;

    constructor() {
        super();
        this.dashboardTab = this.byRole('image', 'Dashboard\nTab 1 of 4');
        this.moreTab = this.byRole('image', 'More\nTab 4 of 4');
    }
}
