
import { error, log } from "console";
import * as fs from "fs";
import * as vscode from "vscode";
import { CppClass } from "./cpp-types";

class FileNotFoundError extends Error {
    constructor( filePath: string ) {
        super( "File not found: '" + filePath + "'" );
    }
}

export class CppFileParser {

    headerDocument: vscode.TextDocument;
    cppDocument: vscode.TextDocument | undefined;

    private headerSymbols: vscode.DocumentSymbol[] | undefined;
    private cppSymbols: vscode.DocumentSymbol[] | undefined;

    constructor( headerDocument: vscode.TextDocument, cppDocument: vscode.TextDocument | undefined ) {
        this.headerDocument = headerDocument;
        this.cppDocument = cppDocument;
    }

    async getHeaderSymbols(): Promise<vscode.DocumentSymbol[] | undefined> {
        if( this.headerSymbols === undefined && this.headerDocument !== undefined ) {
            this.headerSymbols = await vscode.commands.executeCommand( "vscode.executeDocumentSymbolProvider", this.headerDocument.uri );
        }

        return this.headerSymbols;
    }

    async getCppSymbols(): Promise<vscode.DocumentSymbol[] | undefined> {
        if( this.cppSymbols === undefined && this.cppDocument !== undefined ) {
            this.cppSymbols = await vscode.commands.executeCommand( "vscode.executeDocumentSymbolProvider", this.cppDocument.uri );
        }

        return this.cppSymbols;
    }

    /**
     * Retrieves a list of classes defined in this parser's header document
     */
    async getClasses(): Promise<CppClass[]> {
        const classList: CppClass[] = [];

        const headerSymbols = await this.getHeaderSymbols();
        if( headerSymbols === undefined ) {
            throw new FileNotFoundError( "Header" );
        }

        // Create CPP class objects for each class in the header document
        headerSymbols
            .filter( symbol => symbol.kind === vscode.SymbolKind.Class )
            .forEach( async ( headerSymbol ) => {
                // If there's a CPP file, find symbols from it that mention this class

                console.log( "Header Symbol: " + headerSymbol.name );

                const cppSymbols: vscode.DocumentSymbol[] = [];
                if( this.cppDocument !== undefined ){

                    const className = headerSymbol.name;
                    const cppSymbols = await this.getCppSymbols();
                    
                    if( cppSymbols === undefined ){
                        throw new Error( "Could not retrieve CPP symbols when finding classes" );
                    }
                    
                    cppSymbols
                        .filter( symbol => symbol.kind === vscode.SymbolKind.Function )
                        .forEach( cppSymbol => {
                            if( cppSymbol.detail === className ){
                                cppSymbols.push( cppSymbol );
                            }
                        } );
                }

                classList.push(
                    new CppClass( this.headerDocument, headerSymbol, this.cppDocument, cppSymbols )
                );  
            } );

        return classList;
    }
}