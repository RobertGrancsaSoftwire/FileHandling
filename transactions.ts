type Parties = {
    To: string,
    From: string
}

export interface TransactionXML {
    Parties: Parties,
    Description: string,
    Value: string,
    '@_Date': string,
}

export interface TransactionJson {
    Date: Date,
    FromAccount: string,
    ToAccount: string,
    Narrative: string,
    Amount: string
}

export interface Transaction {
    Date: Date,
    From: string,
    To: string,
    Narrative: string,
    Amount: string
}