import * as vscode from 'vscode';
import { CppField } from "./cpp-field";
import { CppFunction } from "./cpp-function";
import { ErrorUtils } from '../../utils/error-utils';
import { TextUtils } from '../../utils/text-utils';
import { CppDataType } from './cpp-data-type';
import { CppTemplate } from './cpp-template';
import { CppParent } from './cpp-parent';

/**
 * A representation of a C++ class's parsed header
 */
export class CppClass {
    private constructor(
        public Name: string,
        public HeaderPath: string,
        public Parents: CppParent[]|undefined,
        public Templates: CppTemplate[]|undefined,
        public Static: CppRealm,
        public Instance: CppRealm
    ){}

    /**
     * Read and parse a C++ header file into a CPP class definition
     * @param className The class within the header file to parse
     */
    public static async read( headerDocument: vscode.TextDocument, className: string ): Promise<CppClass> {
        // Use the VSCode C++ language server to parse the header into "symbols" that are a bit easier to work with
        const classSymbol = await CppClass.getClassSymbol( headerDocument.uri, className );

        // Retrieve info from the class's declaration
        const classString = headerDocument.getText( classSymbol.range );
        const classInfo = CppClass.getDeclarationInfo( classString );

        // Split up the class's symbols into lists based on their types (field, function, enum, etc.)
        const childSymbolLists = CppClass.categorizeChildSymbols( classSymbol );

        // Parse the symbol lists into our internal CPP classes
        const cppFields = CppField.fromSymbols( headerDocument, childSymbolLists.FieldSymbols );
        const cppFunctions = CppFunction.fromSymbols( headerDocument, childSymbolLists.FunctionSymbols );

        const staticFields      = cppFields.filter( ( field ) => field.IsStatic );
        const instanceFields    = cppFields.filter( ( field ) => !field.IsStatic );
        const staticFunctions   = cppFunctions.filter( (func) => func.IsStatic );
        const instanceFunctions = cppFunctions.filter( (func) => !func.IsStatic );

        const staticRealm = new CppRealm( staticFields, staticFunctions );
        const instanceRealm = new CppRealm( instanceFields, instanceFunctions );

        return new CppClass( classInfo.ClassName, headerDocument.uri.path, classInfo.Parents, classInfo.Templates, staticRealm, instanceRealm );
    }

    /**
     * Retrieves the class name and parentage from the class definition
     */
    public static getDeclarationInfo( classString: string ):{
        ClassName: string,
        Parents: CppParent[]|undefined,
        Templates: CppTemplate[]|undefined
    }{
        let className: string|undefined;
        let parents:   CppParent[] = [];
        let templates:  CppTemplate[]|undefined;

        const tokens = [];
        let currentToken = "";

        // State tracking
        let genericDepth = 0; // How many '<' have we seen that haven't yet had a matching '>'?
        let hasParents = false;

        for( let charIndex = 0; charIndex < classString.length; charIndex++ ){
            const char = classString[charIndex];
            
            // End of class definition
            if( char === "{" ){
                break;
            }

            switch( char ){

                // Whitespace
                case "\t":
                case "\n":
                case " ": {
                    // Ignore unhelpful whitespace
                    if( currentToken.length === 0 ){
                        break;
                    }

                    // Generic types can have ' ' within their definition
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    // Each parent is a single, large token
                    if( hasParents ){
                        currentToken += char;
                        break;
                    }

                    // Handle templated classes
                    if( TextUtils.containsAll( currentToken, "template", "<", ">" ) ){
                        templates = CppTemplate.fromString( currentToken );
                        currentToken = "";
                        break;
                    }

                    // We simply do not care about the "class" keyword
                    if( currentToken === "class" ){
                        currentToken = "";
                        break;
                    }

                    // Whitespace is generally a token separator
                    tokens.push( currentToken );
                    currentToken = "";
                    break;
                }

                case ",": {
                    // Generics/Templates can contain commas
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    // Other than templates, I think only parents should contain commas
                    if( !hasParents ){
                        ErrorUtils.unexpectedChar( char, charIndex, classString );
                    }

                    // The current token should be a parent definition
                    const parent = CppParent.fromString( currentToken );
                    currentToken = "";

                    parents.push( parent );
                    
                    break;
                }

                // Start of parent class names
                case ":": {
                    if( hasParents ){
                        ErrorUtils.unexpectedChar( char, charIndex, classString );
                    }

                    hasParents = true;

                    // The token prior to ':' is the class name
                    className = tokens[tokens.length - 1];

                    break;
                }

                // Generic/template start
                case "<": {
                    genericDepth++;
                    currentToken += char;
                    break;
                }

                // Generic/template end
                case ">": {
                    genericDepth--;
                    currentToken += char;
                    break;
                }

                default: {
                    currentToken += char;
                    break;
                }
            }
        }

        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        // The final token is the last parent
        if( hasParents ){
            const parent = CppParent.fromString( tokens[tokens.length - 1] );
            parents.push( parent );
        }

        // Handles the most basic case where 
        if( className === undefined ){
            className = tokens[0];
        }

        if( className === undefined ){
            ErrorUtils.error( `Unable to find class name in '${classString}'` );
        }

        return {
            ClassName: className,
            Parents: parents,
            Templates: templates
        };
    }

    /**
     * Sorts a list of document symbols by their position in their containing document
     */
    private static sortSymbolList( symbolList: vscode.DocumentSymbol[] ): vscode.DocumentSymbol[] {
        return symbolList.sort( ( a, b ) => a.range.start.isBefore( b.range.start ) ? -1 : 1 );
    }

    /**
     * Splits a class symbol into arrays for each of the symbol types a class symbol may contain
     */
    private static categorizeChildSymbols( classSymbol: vscode.DocumentSymbol ):{
        FunctionSymbols: vscode.DocumentSymbol[],
        FieldSymbols:    vscode.DocumentSymbol[],
        EnumSymbols:     vscode.DocumentSymbol[],
        OperatorSymbols: vscode.DocumentSymbol[]
    }{
        // Sort the class's child symbols by their type
        let functionSymbols = [];
        let fieldSymbols    = [];
        let enumSymbols     = [];
        let operatorSymbols = [];
        for( let childIndex = 0; childIndex < classSymbol.children.length; childIndex++ ){
            const childSymbol = classSymbol.children[childIndex];
            switch( childSymbol.kind ){
                case vscode.SymbolKind.Field:
                    fieldSymbols.push( childSymbol );
                    break;
            
                case vscode.SymbolKind.Method:
                    functionSymbols.push( childSymbol );
                    break;

                case vscode.SymbolKind.Enum:
                    enumSymbols.push( childSymbol );
                    break;

                case vscode.SymbolKind.Operator:
                    operatorSymbols.push( childSymbol );
                    break;

                default:
                    console.warn( `Unhandled symbol '${childSymbol.name}' of type '${TextUtils.enumToString( vscode.SymbolKind, childSymbol.kind )}'` );
                    break;
            }
        }

        // Sort the symbol lists because the language server cannot be trusted to return them in sorted order
        return {
            FunctionSymbols: this.sortSymbolList( functionSymbols ),
            FieldSymbols:    this.sortSymbolList( fieldSymbols ),
            EnumSymbols:     this.sortSymbolList( enumSymbols ),
            OperatorSymbols: this.sortSymbolList( operatorSymbols )
        };
    }

    /**
     * Finds and returns a specified class's symbol from a given header
     */
    private static async getClassSymbol( header: vscode.Uri, className: string ): Promise<vscode.DocumentSymbol> {
        const allSymbols = await CppClass.getDocumentSymbols( header );
        
        for (let symbolIndex = 0; symbolIndex < allSymbols.length; symbolIndex++) {
            const symbol = allSymbols[symbolIndex];

            if( symbol.name.toLowerCase() === className.toLowerCase() ){
                if( symbol.kind === vscode.SymbolKind.Class ){
                    return symbol;
                }
            }
        }

        throw new Error( `The class '${className}' could not be found within '${header.path}'` );
    }

    /**
     * Uses the VSCode C++ language server to parse a given uri into easier to use document symbols 
     */
    private static async getDocumentSymbols( uri: vscode.Uri ): Promise<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
            "vscode.executeDocumentSymbolProvider",
            uri
        );
        return ( symbols !== undefined ) ? symbols : [];
    }
}

export class CppRealm {
    public constructor(
        public Fields: CppField[],
        public Functions: CppFunction[]
    ){}
}



