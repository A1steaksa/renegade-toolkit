import { Exception } from 'handlebars';
import * as vscode from 'vscode';

export enum AccessSpecifier {
    Public,
    Private,
    Protected
}

export class CppParent {
    accessSpecifier: AccessSpecifier;
    name: string;

    constructor( accessSpecifier: AccessSpecifier, name: string ) {
        this.accessSpecifier = accessSpecifier;
        this.name = name;
    }
}

export class CppVariable {
    dataType: string;
    name: string;

    constructor( dataType: string, name: string ) {
        this.dataType = dataType;
        this.name = name;
    }
}

export class CppFunction {
    private textDocument: vscode.TextDocument;
    private symbol: vscode.DocumentSymbol;
    private text: string;

    private isStatic:   boolean | undefined;
    private returnType: string | undefined;
    private name:       string | undefined;
    private arguments:  CppVariable[] | undefined;

    constructor( symbol: vscode.DocumentSymbol, textDocument: vscode.TextDocument ){
        this.symbol = symbol;
        this.textDocument = textDocument;

        this.text = textDocument.getText( symbol.range );

        console.log( this.text );
    }
}

export class CppClass {

    /** Regex that matches against parent class definitions in header text */
    private static parentRegex = new RegExp( "(?:(public|private|protected)\\s+(\\w+))", "gm" );


    /** The class's parsed header document symbol */
    private headerSymbols: vscode.DocumentSymbol;

    /** The symbols from this class's cpp file that are part of this class */
    private cppSymbols: vscode.DocumentSymbol[];

    /** The class's name */
    public name: string;

    /** The text document containing the class's .h portion */
    headerDocument: vscode.TextDocument;

    /** The portion of the document where the class resides in the header document */
    private headerRange: vscode.Range;

    /** The text document containing the class's .cpp portion */
    cppDocument: vscode.TextDocument | undefined;

    /** The class names of the */
    private parents: CppParent[] | undefined;

    /** Static class-level variables */
    private classVariables: CppVariable[] | undefined;

    /** Per-instance member variables */
    private instanceVariables: CppVariable[] | undefined;

    /** The header range extracted from the header document */
    private headerText: string | undefined;

    /** The cpp range extracted from the cpp document */
    private cppText: string | undefined;


    constructor(
        headerDocument: vscode.TextDocument,
        headerSymbols: vscode.DocumentSymbol,
        cppDocument: vscode.TextDocument | undefined,
        cppSymbols: vscode.DocumentSymbol[]
    ) {
        this.headerSymbols = headerSymbols;
        this.cppSymbols = cppSymbols;

        this.name = headerSymbols.name;
        this.headerRange = headerSymbols.range;

        this.headerDocument = headerDocument;
        this.cppDocument = cppDocument;
    }

    setCpp( cppDocument: vscode.TextDocument ){
        this.cppDocument = cppDocument;
    }

    /** Retrieves the text of the class in the .h document */
    getHeaderText(): string {
        // Cache the text
        if( this.headerText === undefined ) {
            this.headerText = this.headerDocument.getText( this.headerRange );
        }

        return this.headerText;
    }

    /** Parses the header text for parent classes */
    getParents(): CppParent[] {
        let parents: CppParent[] = [];

        const headerText = this.getHeaderText();

        const regexResult = headerText.match( CppClass.parentRegex );

        // If the class has no parents
        if( regexResult === null ) {
            return [];
        }

        regexResult.forEach( match => {
            const splitMatch = match.split( new RegExp( "\\s+" ) );

            const accessSpecifierText = splitMatch[0];
            let accessSpecifier: AccessSpecifier;
            switch( accessSpecifierText ){
                case "private": {
                    accessSpecifier = AccessSpecifier.Private;
                    break;
                }

                case "public": {
                    accessSpecifier = AccessSpecifier.Public;
                    break;
                }

                case "protected": {
                    accessSpecifier = AccessSpecifier.Protected;
                    break;
                }

                default: {
                    throw new Exception( "Access specifier is not public, private, or protected: '" + accessSpecifierText + "'" );
                    break;
                }
            }
            
            const name = splitMatch[1];
            
            parents.push( new CppParent( accessSpecifier, name ) );
        } );

        return parents;
    }

    /** Retrieves class methods from the header (and cpp) document(s) */
    getFunctions(): CppFunction[] {
        const functions: CppFunction[] = [];

        // Get header functions
        this.headerSymbols.children.forEach( childSymbol => {
            if( childSymbol.kind === vscode.SymbolKind.Method ){
               functions.push( new CppFunction( childSymbol, this.headerDocument ) );
            }
        } );

        // Get CPP

        return functions;
    }

}