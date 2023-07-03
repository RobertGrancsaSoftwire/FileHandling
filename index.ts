import * as fs from 'fs';
import {parse} from 'csv-parse/sync';
import { Transaction, TransactionXML, TransactionJson } from './transactions';

const readlineSync = require('readline-sync');
const log4js = require("log4js");
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
const moment = require('moment');

log4js.configure({
    appenders: {
        file: { type: 'fileSync', filename: 'logs/debug.log' }
    },
    categories: {
        default: { appenders: ['file'], level: 'debug'}
    }
});

type PersonHistory = {
    Debt: number,
    History: Transaction[],
}

type Owes = {
    [key: string]: PersonHistory;
};

type Account = {
    [key: string]: Owes[]
};

const logger = log4js.getLogger('index.ts');

function parseCsv(filename: string): Transaction[] {
    const transactionsCsv = fs.readFileSync(filename, 'utf-8');

    return parse(transactionsCsv, {
        delimiter: ',',
        columns: true
    }).map(convertCsvToNormal);
}

function parseJson(filename: string): Transaction[] {
    const transactionsJson = fs.readFileSync(filename, 'utf-8');

    return JSON.parse(transactionsJson).map(convertJsonToNormal);
}

function convertCsvToNormal(transaction: Transaction): Transaction {
    let date = moment(transaction.Date, "DD/MM/YYYY");
    if (date == null) {
        logger.debug("Couldn't convert " + transaction.Date + " to a valid date");
        date = new Date();
    }
    transaction.Date = date;

    return transaction;
}

function convertXmlToNormal(transaction: TransactionXML): Transaction {
    return {
        Date: new Date(transaction["@_Date"]),
        Amount: transaction.Value,
        From: transaction.Parties.From,
        To: transaction.Parties.To,
        Narrative: transaction.Description
    }
}

function convertJsonToNormal(transaction: TransactionJson): Transaction {
    let date = new Date(transaction.Date);
    if (date == null) {
        logger.debug("Couldn't convert " + transaction.Date + " to a valid date");
        date = new Date();
    }
    return {
        Date: date,
        Amount: transaction.Amount,
        From: transaction.FromAccount,
        To: transaction.ToAccount,
        Narrative: transaction.Narrative
    }
}

function parseXml(filename: string): Transaction[] {
    const transactionsXml = fs.readFileSync(filename, 'utf-8');

    const parser = new XMLParser({
        ignoreAttributes: false
    });
    const xmlConversion: TransactionXML[] = parser.parse(transactionsXml).TransactionList.SupportTransaction
    return xmlConversion.map(convertXmlToNormal);
}

function calculateAccounts(transactions: Transaction[], accounts: Account) {
    transactions.forEach((transaction: Transaction) => {
        let debt: Owes = {
            [transaction.To]: {
                Debt: parseFloat(transaction.Amount),
                History: [transaction]
            },
        };
        if (accounts[transaction.From] == null) {
            accounts[transaction.From] = [debt];
        } else {
            for (let item of accounts[transaction.From]) {
                if (item[transaction.To] != null) {
                    let amount = parseFloat(transaction.Amount);
                    if (isNaN(amount)) {
                        logger.debug("Cannot convert " + transaction.Amount + " to a number");
                    } else {
                        item[transaction.To].Debt += amount;
                        item[transaction.To].History.push(transaction);
                    }
                    return;
                }
            }
            accounts[transaction.From].push(debt);
        }
    })
}

const transactions = parseCsv("Transactions2014.csv");
logger.debug("Finished parsing Transactions2014.csv");

const dodgyTransactions = parseCsv("DodgyTransactions2015.csv");
logger.debug("Finished parsing DodgyTransactions2015.csv");

const jsonTransactions = parseJson("Transactions2013.json");
logger.debug("Finished parsing Transactions2013.json");

const xmlTransactions = parseXml("Transactions2012.xml");
logger.debug("Finished parsing Transactions2012.xml");

let accounts: Account = {};
calculateAccounts(transactions, accounts);
calculateAccounts(dodgyTransactions, accounts);
calculateAccounts(jsonTransactions, accounts);
calculateAccounts(xmlTransactions, accounts);

let keys = ['All', ...Object.keys(accounts), "Import file", "Export file"];

let index: number = 0;
while (index != -1) {
    index = readlineSync.keyInSelect(keys, 'Which account do you want to print?');
    if (index == 0) {
        console.log(accounts);
    } else if (index == keys.length - 2) {
        let filename: string = readlineSync.question("Enter the name of the file you want to import: ");

        let transactions: Transaction[];
        if (filename.endsWith(".csv")) {
            transactions = parseCsv(filename);
        } else if (filename.endsWith(".json")) {
            transactions = parseJson(filename);
        } else if (filename.endsWith(".xml")) {
            transactions = parseXml(filename);
        } else {
            logger.debug("Bad filetype, please try again");
            continue;
        }

        calculateAccounts(transactions, accounts);
    } else if (index == keys.length - 1) {
        let filename: string = readlineSync.question("Enter the name of the file you want to export to: ");
        if (filename.endsWith(".json")) {
            fs.writeFileSync(filename, JSON.stringify(accounts, null, 2));
        } else if (filename.endsWith(".xml")) {
            const builder = new XMLBuilder({
                format: true
            });
            fs.writeFileSync(filename, builder.build(accounts));
        } else {
            logger.debug("Bad filetype, please try again");
        }
    } else if (index != -1) {
        console.log(keys[index] + ":");
        console.log(accounts[keys[index]]);
    }
}
