const { Builder, By, Key, until, Select } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('node:assert/strict');

async function openRiaWebsite() {
    let driver;
    try {
        // Configure Chrome
        const options = new chrome.Options();
        options.setChromeBinaryPath('/usr/bin/google-chrome');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');

        // Launch Chrome using Selenium
        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        console.log('Chrome browser launched successfully');
        //await driver.manage().window().maximize();
        await driver.manage().window().setRect({
            width: 1365,
            height: 768,
            x: 0,
            y: 0
        });

        // Open Ria Money Transfer
        await driver.get('https://www.riamoneytransfer.com/en-cl/');
        console.log('Opening Ria Money Transfer website...');

        //Check the initial page is cloudflare or home page
        const initialPage = await driver.wait(
            async () => {
                const cloudflare = await driver.findElements(By.xpath("//h2[normalize-space()='Performing security verification']"));
                if (cloudflare.length > 0 && await cloudflare[0].isDisplayed()) {
                    return 'CLOUDFLARE';
                }
                const title = await driver.getTitle();
                if (title.includes('Ria Money Transfer')) {
                    return 'HOME';
                }
                return false;
            },
            120000, 'Ria website did not load within 2 minutes', 500
        );

        //Passing Cloudflare page to reach home page
        if (initialPage === 'CLOUDFLARE') {
            console.log('Cloudflare verification detected, please complete the verification manually');
            await driver.wait(
                async () => {
                    const title = await driver.getTitle();
                    return title.includes('Ria Money Transfer');
                },
                120000, 'Ria homepage did not load within 2 minutes', 500
            );
            console.log('Cloudflare verification completed.');
        }
        console.log('Ria Money Transfer website opened successfully');
        const currentUrl = await driver.getCurrentUrl();

        // Wait for cookie popup
        const cookiePopup = await driver.wait(
            async () => {
                const popup = await driver.findElements(By.xpath("//section[@role='dialog']"));
                return popup.length > 0 && await popup[0].isDisplayed() ? popup[0] : false;
            }, 10000, 'Cookie popup not displayed', 500
        )
        // .catch(error => {
        //     if (error.name === 'TimeoutError') {
        //         return null;
        //     }
        //     throw error;
        // }
        // );
        if (cookiePopup) {
            const acceptAllButton = await cookiePopup.findElement(By.xpath(".//button[normalize-space()='Accept All']"));
            await acceptAllButton.click();
            console.log('Cookie popup displayed and clicked Accept All button');
        }
        else {
            console.log('Cookie popup not displayed, proceeding to next step');
        }

        //Checking for the calculator
        const calculator = await driver.findElement(By.css('[aria-label="Transfer quote calculator"]'));
        assert.ok(await calculator.isDisplayed(), 'Calculator is not displayed');
        console.log('Ria Calculator is present');
        const sendField = await driver.findElement(By.id('amount-from'));
        const receiveField = await driver.findElement(By.id('amount-to'));
        const minValue_S = Number(await sendField.getAttribute('min'));
        const maxValue_S = Number(await sendField.getAttribute('max'));
        const minValue_R = Number(await receiveField.getAttribute('min'));
        const maxValue_R = Number(await receiveField.getAttribute('max'));
        const testCases = [
            'ABC',
            'abc',
            '@#$%',
            '99ABC',
            'abc999',
            'a99b',
            '9nh8',
            '0yy'
        ];
        // Reusable Fluent Wait for minimum or maximum amout validation error
        async function waitForAmountError() {
            return await driver.wait(
                async () => {
                    const errors = await driver.findElements(By.xpath("//p[@id='amount-error']"));
                    for (const error of errors) {
                        if (await error.isDisplayed()) {
                            const text = await error.getText();
                            if (text.includes('Minimum') || text.includes('Maximum')) {
                                return text;
                            }
                        }
                    }
                    return false;
                }, 5000, 'Expected minimum or maximum amout validation error is not displayed', 500);
        }
        for (const input of testCases) {
            await sendField.click();
            await sendField.sendKeys(Key.CONTROL, 'a');
            await sendField.sendKeys(Key.BACK_SPACE);
            await sendField.sendKeys(input);
            const actualValue = await sendField.getProperty('value');
            console.log('\nTesting input:', input);
            console.log('Actual input value:', actualValue);
            try {
                // Condition 1: Input contains only alphabets or special characters
                if (!/[0-9]/.test(input)) {
                    assert.strictEqual(actualValue, '', 'FAIL: Invalid characters are accepted in Send textbox');
                    console.log('PASS: Invalid characters are rejected and the actual input is empty in Send textbox');
                }
                // Condition 2: Input contains numbers, with or without alphabets
                else {
                    const expectedValue = input.replace(/[^0-9.]/g, '');
                    const normalizedValue = actualValue.replace(/,/g, '');
                    assert.strictEqual(Number(normalizedValue), Number(expectedValue), 'FAIL: Invalid characters are accepted in Send textbox');
                    console.log('PASS: Invalid characters are removed and integers are retained in Send textbox');
                    const numericValue = Number(normalizedValue);
                    // Check minimum and maximum range
                    if (numericValue < minValue_S || numericValue > maxValue_S) {
                        const errorText = await waitForAmountError();
                        assert.ok(errorText, 'FAIL: Minimum or Maximum amount validation error message not displayed in Send textbox');
                        console.log('PASS: Error message displayed in Send textbox:', errorText);
                    } else {
                        assert.ok(numericValue >= minValue_S && numericValue <= maxValue_S, 'FAIL: Entered amount is not within the accepted range in Send textbox');
                        console.log('PASS: Entered amount is within the accepted range in Send textbox');
                    }
                }
            } catch (error) {
                console.log('FAIL:', input);
                console.log('Reason:', error.message);
            }
        }
        for (const input of testCases) {
            await receiveField.click();
            await receiveField.sendKeys(Key.CONTROL, 'a');
            await receiveField.sendKeys(Key.BACK_SPACE);
            await receiveField.sendKeys(input);
            const actualValue = await receiveField.getProperty('value');
            console.log('\nTesting input:', input);
            console.log('Actual input value:', actualValue);
            try {
                // Condition 1: Input contains only alphabets or special characters
                if (!/[0-9]/.test(input)) {
                    assert.strictEqual(actualValue, '', 'FAIL: Invalid characters are accepted in Receive textbox');
                    console.log('PASS: Invalid characters are rejected and the actual input is empty in Receive textbox');
                }
                // Condition 2: Input contains numbers, with or without alphabets
                else {
                    const expectedValue = input.replace(/[^0-9.]/g, '');
                    const normalizedValue = actualValue.replace(/,/g, '');
                    assert.strictEqual(Number(normalizedValue), Number(expectedValue), 'FAIL: Invalid characters are accepted in Receive textbox');
                    console.log('PASS: Invalid characters are removed and integers are retained in Receive textbox');
                    const numericValue = Number(normalizedValue);
                    // Check minimum and maximum range
                    if (numericValue < minValue_S || numericValue > maxValue_S) {
                        const errorText = await waitForAmountError();
                        assert.ok(errorText, 'FAIL: Minimum or Maximum amount validation error message not displayed in Receive textbox');
                        console.log('PASS: Error message displayed in Receive textbox:', errorText);
                    } else {
                        assert.ok(numericValue >= minValue_S && numericValue <= maxValue_S, 'FAIL: Entered amount is not within the accepted range in Receive textbox');
                        console.log('PASS: Entered amount is within the accepted range in Receive textbox');
                    }
                }
            } catch (error) {
                console.log('FAIL:', input);
                console.log('Reason:', error.message);
            }
        }
        const countryDropdown = await driver.findElement(By.xpath("//button[@aria-label='Select Destination']"));
        assert.ok(await countryDropdown.isDisplayed(), 'Send to dropdown is not displayed');
        console.log('Send to dropdown is visible');

        await countryDropdown.click();
        console.log('Send to dropdown clicked');

        const countrySearch = await driver.findElement(By.xpath("//input[@aria-label='Search currency or country']"));
        const countryName = 'Haiti'
        await countrySearch.sendKeys(countryName);
        console.log(`"${countryName}" is entered in the search field`);

        let currencySelected;
        const rightArrow = await driver.findElements(By.xpath("//span[@aria-hidden='true' and contains(@class,'shrink-0')]"));
        if (rightArrow.length > 0 && await rightArrow[0].isDisplayed()) {
            const countryOption = await driver.findElement(By.xpath(`//button[@role='option' and .//span[contains(@class,'text-base') and normalize-space()='${countryName}']]`));
            await countryOption.click();
            console.log(`"${countryName}" is selected`);
            currencySelected = 'HTG';
            const currencyOption = await driver.findElement(By.xpath(`//button[@role='option' and .//span[normalize-space()='${currencySelected}']]`));
            await currencyOption.click();
            console.log(`"${currencySelected}" is selected`);
        } else {
            currencySelected = await driver.findElement(By.xpath(`//button[@role='option' and .//span[normalize-space()='${countryName}']]//span[contains(@class,'text-neutral-500')]`)).getText();
            console.log(currencySelected, 'is displayed');
            const countryOption = await driver.findElement(By.xpath(`//button[@role='option' and .//span[contains(@class,'text-base') and normalize-space()='${countryName}']]`));
            await countryOption.click();
            console.log(`"${countryName}" is selected`);
        }

        const currencyDisplayed = await driver.findElement(By.xpath("//button[@aria-label='Select Destination']//span[@class='font-medium']")).getText();
        console.log('Currency displayed in the Receive textbox:', currencyDisplayed);

        assert.strictEqual(currencyDisplayed, currencySelected, 'Displayed currency does not match the selected currency in the Receive textbox');
        console.log('PASS: Displayed currency matches the selected currency in the Receive textbox');

        const testAmounts = [25000];
        for (const input of testAmounts) {
            await sendField.click();
            await sendField.sendKeys(Key.CONTROL, 'a');
            await sendField.sendKeys(Key.BACK_SPACE);
            await sendField.sendKeys(input);

            // Exchange rate
            const exchangeRateElement = await driver.wait(
                async () => {
                    const elements = await driver.findElements(By.xpath("//span[contains(@class,'text-green-950') and contains(@class,'text-sm')]"));
                    if (elements.length > 0 && await elements[0].isDisplayed()) {
                        return elements[0];
                    }
                    return false;
                }, 10000, 'Exchange rate was not displayed', 500);
            const exchangeRateText = await exchangeRateElement.getText();
            const exchangeRate = Number(exchangeRateText.replace(/[^0-9.]/g, ''));
            // Epected Amount
            const calculatedAmount = input * exchangeRate;
            const expectedReceiveAmount = Math.trunc(calculatedAmount * 100) / 100;
            // Actual Amount
            const actualReceiveAmount = Number((await receiveField.getProperty('value')).replace(/,/g, ''));
            console.log('----------------------------------------------');
            console.log('Input amount:', input);
            console.log('Exchange rate:', exchangeRate);
            console.log('Expected Receive Amount:', expectedReceiveAmount);
            console.log('Actual Receive Amount:', actualReceiveAmount);
            // Compare expected and actual values
            assert.strictEqual(actualReceiveAmount, expectedReceiveAmount, 'Expected Receive amount does not match the actual Receive amount');
            console.log('PASS: Expected and actual Receive amounts match');
        }

        const startTransferButton = await driver.findElement(By.xpath("//a[normalize-space()='Start your transfer']"));
        assert.ok(await startTransferButton.isDisplayed(), 'Start your transfer button is not displayed');
        assert.ok(await startTransferButton.isEnabled(), 'Start your transfer button is not enabled');
        console.log('Start your transfer button is visible and enabled');
        await startTransferButton.click();
        console.log('Start your transfer button clicked');
        await driver.wait(
            async () => (await driver.getCurrentUrl()) !== currentUrl, 10000, 'Page navigation did not happen', 500
        );
        const expectedUrl = 'https://secure.riamoneytransfer.com/';
        await driver.wait(async () => {
            const readyState = await driver.executeScript('return document.readyState');
            return readyState === 'complete';
        }, 15000, 'Page did not load completely');
        const actualUrl = await driver.getCurrentUrl();
        // Compare only the domain, ignoring the path
        const actualOrigin = new URL(actualUrl).origin;
        const expectedOrigin = new URL(expectedUrl).origin;
        assert.strictEqual(actualOrigin, expectedOrigin, 'User was not navigated to the expected domain');
        console.log('Navigated successfully to the URL - ', actualUrl);
        const cookiePopup2 = await driver.findElements(By.xpath("//section[.//h1[contains(normalize-space(.),'Cookies give you a personalized experience')]]"));
        if (cookiePopup2.length > 0 && await cookiePopup2[0].isDisplayed()) {
            const acceptAllButton = await cookiePopup2[0].findElement(By.xpath(".//button[@analytics-name='consent-manager-allow-all-cookies']"));
            await acceptAllButton.click();
            console.log('Cookie popup was displayed. Accept All was clicked.');
        } else {
            console.log('Cookie popup was not displayed. Continuing test execution.');
        }
        // Verify Phone or email field is present
        const phoneEmailField = await driver.findElement(By.xpath("//label[normalize-space()='Phone or email']"));
        assert.ok(await phoneEmailField.isDisplayed(), 'Phone or email field is not displayed');
        console.log('Phone or Email field is displayed');
        // Verify Phone or email input field
        const phoneInput = await driver.findElement(By.id('v-6-input'));
        assert.ok(await phoneInput.isDisplayed(), 'Phone or email input field is not displayed');
        console.log('Phone or Email input field is displayed');
        // Verify Password field is present
        const passwordField = await driver.findElement(By.xpath("//label[normalize-space()='Password']"));
        assert.ok(await passwordField.isDisplayed(), 'Password field is not displayed');
        console.log('Password field is displayed');
        const passwordInput = await driver.findElement(By.css("input[analytics-name='login-password']"));
        assert.ok(await passwordInput.isDisplayed(), 'Login password field is not displayed');
        console.log('Password input field is displayed');
        // Verify Register button/link is present
        const registerButton = await driver.findElement(By.xpath("//a[@href='/registration' and .//span[normalize-space()='Register']]"));
        assert.ok(await registerButton.isDisplayed(), 'Register button is not displayed');
        console.log('Register button is displayed');
        registerButton.click();
        const expectedUrl2 = "https://secure.riamoneytransfer.com/registration";
        // Wait until the URL changes
        await driver.wait(async () => (await driver.getCurrentUrl()) === expectedUrl2, 10000);
        // Verify navigation
        const actualUrl2 = await driver.getCurrentUrl();
        assert.strictEqual(actualUrl2, expectedUrl2, "User is not navigated to the Registration page");
        console.log("Successfully navigated to Registration page");
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        if (driver) {
            await driver.quit();
        }
    }
}

openRiaWebsite();