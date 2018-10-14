const cpfSelectors = {
    oaSelector: "#AccountSummary > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > span.rwd-new-row > strong > label",
    maSelector: "#AccountSummary > div:nth-child(1) > div:nth-child(2) > div:nth-child(4) > span.rwd-new-row > strong > label",
    saSelector: "#AccountSummary > div:nth-child(1) > div:nth-child(2) > div:nth-child(3) > span.rwd-new-row > strong > label"
}

require('dotenv').config()
const puppeteer = require('puppeteer')

const CPF_LOGIN_LINK = "https://www.cpf.gov.sg/eSvc/Web/PortalServices/WelcomePage"
const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3563.0 Mobile Safari/537.36"
const SINGPASS_QR_SELECTOR = '#qrcodeloginli > a'
const SINGPASS_LOGIN_LINK_SELECTOR = 'qrcodelink'

const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {polling: true});

bot.onText(/balance/, (msg, match) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Getting CPF Login...")
    initCPFPage()
    .then(getSingpassQR)
    
    .then(({browser, page, loginLink}) => {
        bot.sendMessage(chatId, loginLink, { disable_web_page_preview: true })
        return {browser, page}
    })
    
    .then(readCPF)
    .then((balances) => {
        response = `OA: ${balances.oa}, SA: ${balances.sa}, MA: ${balances.ma}`
        bot.sendMessage(chatId, response)
    })
})

async function pollForSingpassQR(page) {
    const QRLinkRegex = /(https:\/\/www\.singpassmobile\.sg)(.*)/ 
    let qrLinkElement = '';
    while (!QRLinkRegex.test(qrLinkElement)) {
     qrLinkElement = await page.$(SINGPASS_QR_SELECTOR)
     console.log(qrLinkElement.jsonValue())
     await new Promise((resolve) => { setTimeout(resolve, 500)})
    }
}


async function initCPFPage() {
    const browser = await puppeteer.launch({ headless: false })
    
    const page = await browser.newPage()
    page.setUserAgent(MOBILE_USER_AGENT)
    await page.goto(CPF_LOGIN_LINK),
 
    await pollForSingpassQR(page)
    
    return {browser, page}; 
}

async function getSingpassQR({browser, page}) {
    await page.click(SINGPASS_QR_SELECTOR)
    await page.click(SINGPASS_QR_SELECTOR)

    
    await page.waitFor(10*1000)
    let loginLink = await page.evaluate((sel) => {
        const link = document.getElementById(sel)
        return link.href
    }, SINGPASS_LOGIN_LINK_SELECTOR)
    
    console.log("login link = ", loginLink)
    return {browser, page, loginLink}
}

async function readCPF({browser, page, loginLink}) {
    let oaBalanceEl = await page.waitForSelector(cpfSelectors.oaSelector, { timeout: 60 * 1000 })
    
    let balances = await page.evaluate((cpfSelectors) => {
        let oa = document.querySelector(cpfSelectors.oaSelector).textContent
        let sa = document.querySelector(cpfSelectors.saSelector).textContent
        let ma = document.querySelector(cpfSelectors.maSelector).textContent
    
        return { oa, sa, ma }
    }, cpfSelectors)
    
    console.log("balances:", balances)
    browser.close()
    return balances
}
