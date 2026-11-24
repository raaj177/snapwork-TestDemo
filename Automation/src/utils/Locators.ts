// Lazy, platform-aware locator builders in priority order: byRole -> byId -> byLabel -> byText -> byXPath (last).
// Each returns a function, so page objects assign locators in their constructor before a session exists.
import type { ChainablePromiseElement } from 'webdriverio';
import { logger, describeError } from './Logger';
import { currentPlatform } from './PlatformUtils';

const log = logger.child({ module: 'Locators' });

export type ElementLocator = () => ChainablePromiseElement;

/** Android widget class / iOS element type per role. */
export const ROLE_MAP: Readonly<Record<string, { android: string; ios: string }>> = {
    button: { android: 'android.widget.Button', ios: 'XCUIElementTypeButton' },
    textbox: { android: 'android.widget.EditText', ios: 'XCUIElementTypeTextField' },
    password: { android: 'android.widget.EditText', ios: 'XCUIElementTypeSecureTextField' },
    text: { android: 'android.widget.TextView', ios: 'XCUIElementTypeStaticText' },
    checkbox: { android: 'android.widget.CheckBox', ios: 'XCUIElementTypeSwitch' },
    switch: { android: 'android.widget.Switch', ios: 'XCUIElementTypeSwitch' },
    image: { android: 'android.widget.ImageView', ios: 'XCUIElementTypeImage' },
};

function quoteXPath(text: string): string {
    if (!text.includes("'")) return `'${text}'`;
    if (!text.includes('"')) return `"${text}"`;
    return `concat('${text.split("'").join(`', "'", '`)}')`;
}

/** Builds the selector string for a role + accessible name (≈ getByRole). */
export function roleSelector(role: string, name: string): string {
    log.debug(`Building role selector for ${role}`);
    try {
        const mapped = ROLE_MAP[role];
        if (!mapped) throw new Error(`Unknown role "${role}" (known: ${Object.keys(ROLE_MAP).join(', ')})`);
        const selector =
            currentPlatform() === 'ios'
                ? `-ios predicate string:type == '${mapped.ios}' AND (label == '${name.replace(/'/g, "\\'")}' OR name == '${name.replace(/'/g, "\\'")}')`
                : `//${mapped.android}[@content-desc=${quoteXPath(name)} or @text=${quoteXPath(name)}]`;
        log.debug('Role selector built');
        return selector;
    } catch (error) {
        log.error(`Failed to build role selector: ${describeError(error)}`);
        throw error;
    }
}

/** Builds the selector string for a resource-id / accessibility identifier (≈ getById). */
export function idSelector(id: string): string {
    log.debug(`Building id selector for ${id}`);
    try {
        const selector =
            currentPlatform() === 'ios'
                ? `-ios predicate string:name == '${id.replace(/'/g, "\\'")}'`
                : `android=new UiSelector().resourceId("${id}")`;
        log.debug('Id selector built');
        return selector;
    } catch (error) {
        log.error(`Failed to build id selector: ${describeError(error)}`);
        throw error;
    }
}

/** Builds the selector string for visible text. */
export function textSelector(text: string): string {
    log.debug('Building text selector');
    try {
        const selector =
            currentPlatform() === 'ios'
                ? `-ios predicate string:label == '${text.replace(/'/g, "\\'")}' OR value == '${text.replace(/'/g, "\\'")}'`
                : `//*[@text=${quoteXPath(text)}]`;
        log.debug('Text selector built');
        return selector;
    } catch (error) {
        log.error(`Failed to build text selector: ${describeError(error)}`);
        throw error;
    }
}

/** byRole: class/type + accessible name. */
export function byRole(role: string, name: string): ElementLocator {
    log.debug(`Creating byRole locator (${role})`);
    return () => $(roleSelector(role, name));
}

/** byId: Android resource-id / iOS accessibility identifier. */
export function byId(id: string): ElementLocator {
    log.debug(`Creating byId locator (${id})`);
    return () => $(idSelector(id));
}

/** byLabel: accessibility id (content-desc / accessibility label). */
export function byLabel(label: string): ElementLocator {
    log.debug('Creating byLabel locator');
    return () => $(`~${label}`);
}

/** byText: visible text. */
export function byText(text: string): ElementLocator {
    log.debug('Creating byText locator');
    return () => $(textSelector(text));
}

/** byXPath: last resort; every use needs a handoff note. */
export function byXPath(xpath: string): ElementLocator {
    log.debug('Creating byXPath locator');
    return () => $(xpath);
}

/** byAria: aria-label inside a web view context. */
export function byAria(name: string): ElementLocator {
    log.debug('Creating byAria locator');
    return () => $(`aria/${name}`);
}

/** byCss: CSS selector inside a web view context. */
export function byCss(selector: string): ElementLocator {
    log.debug('Creating byCss locator');
    return () => $(selector);
}
