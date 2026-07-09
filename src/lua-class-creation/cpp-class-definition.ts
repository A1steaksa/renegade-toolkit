import * as vscode from 'vscode';
import { TextUtils } from '../utils/text-utils';

/**
 * A representation of a C++ class's parsed header
 */
export class CppClassDefinition {
    private constructor(
        public Name: string,
        public HeaderPath: string,
        public Parents: CppParent[],
        public Static: CppRealm,
        public Instance: CppRealm
    ){}

    /**
     * Read and parse a C++ header file into a CPP class definition
     * @param className The class within the header file to parse
     */
    public static async read( headerDocument: vscode.TextDocument, className: string ): Promise<CppClassDefinition> {
        // Use the VSCode C++ language server to parse the header into "symbols" that are a bit easier to work with
        const classSymbol = await CppClassDefinition.getClassSymbol( headerDocument.uri, className );

        // Split up the class's symbols into lists based on their types (field, function, enum, etc.)
        const childSymbolLists = CppClassDefinition.categorizeChildSymbols( classSymbol );

        // Parse the symbol lists into our internal CPP classes
        const cppFields = CppField.fromSymbols( headerDocument, childSymbolLists.FieldSymbols );
        
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
        const allSymbols = await CppClassDefinition.getDocumentSymbols( header );
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

enum CppAccessType {
    Public,
    Private,
    Protected
}

class CppParent {
    public constructor(
        public Name: string,
        public Access: CppAccessType,
    ){}
}

class CppRealm {
    public constructor(
        public Fields: CppField[],
        public Functions: CppFunction[]
    ){}
}

export class CppField {
    public constructor(
        public IsStatic: boolean,
        public IsMutable: boolean = false,
        public Name: string,
        public DataType: CppDataType,
        public ArrayDepth: number = 0,
    ){}

    public static fromSymbols( headerDocument: vscode.TextDocument, fields: vscode.DocumentSymbol[] ): CppField[] {
        const cppFields: CppField[] = [];

        for( let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++ ){
            const fieldSymbol = fields[fieldIndex];
            const fieldText = headerDocument.getText( fieldSymbol.range );
            cppFields.push( this.fromString( fieldText ) );
        }

        return cppFields;
    }

    public static fromString( declaration: string ): CppField {

        // "Collapse" whitespace down to a single space
        declaration = declaration.replaceAll( /\s+/g, " " );

        // Remove the semicolon
        declaration = declaration.replaceAll( ";", "" ).trim();

        // Remove the "static" keyword
        const isStatic = declaration.startsWith( "static" );
        declaration = TextUtils.removeBeginnings( declaration, [ "static" ] ).trim();

        // Remove the "mutable" keyword
        const isMutable = declaration.startsWith( "mutable" );
        declaration = TextUtils.removeBeginnings( declaration, [ "mutable" ] ).trim();

        // Remove the field name
        const fieldNameStartIndex = declaration.lastIndexOf( " " ) + 1;
        const fieldName = declaration.substring( fieldNameStartIndex ).trim();
        declaration = declaration.substring( 0, fieldNameStartIndex ).trim();

        // Check for array indicators
        const arrayStartIndex = declaration.indexOf( "[" );
        if( arrayStartIndex !== -1 ){
            const errorString = `Unhandled array syntax in '${declaration}'`;
            console.error( errorString );
            throw Error( errorString );
        }

        // At this point the only thing left in the declaration string should be the data type
        const dataType = CppDataType.fromString( declaration );

        return new CppField( isStatic, isMutable, fieldName, dataType );
    }
}

export class CppDataType {
    public constructor(
        public Name: string,
        public Generics: CppDataType[]|undefined = undefined
    ){}

    public static fromString( dataTypeString: string ): CppDataType {
        const pointerCount = TextUtils.count( dataTypeString, "*" );
        if( pointerCount > 1 ){
            console.error( "Handling for multi-dimensional pointers hasn't been implemented yet" );
        }

        // Get rid of pointer syntax
        dataTypeString = dataTypeString.replace( "*", "" ).trim();

        // Remove spaces
        dataTypeString = dataTypeString.replace( /\s+/g, "" ).trim();

        // The variables we'll be using to create this data type
        let dataTypeName: string|undefined;
        let generics: CppDataType[] = [];

        // How many layers of nested generics we're currently at
        let genericDepth = 0;

        let currentGenericStartIndex = -1;

        // Iterate over each character in the string
        for( let charIndex = 0; charIndex < dataTypeString.length; charIndex++ ){
            const char = dataTypeString[charIndex];
            switch( char ){

                // Start of generic
                case "<": {
                    if( genericDepth === 0 ){
                        // This handles the name of types that have generics but not types without generics
                        dataTypeName = dataTypeString.substring( 0, charIndex );

                        currentGenericStartIndex = charIndex;
                    }
                    genericDepth++;
                    break;
                }
                
                // Generic separator
                case ",": {
                    // Ignore commas within nested generics
                    if( genericDepth !== 1 ){ break; }

                    // This handle all top-level generics other than the final one which does not end with a comma
                    const currentGenericString = dataTypeString.substring( currentGenericStartIndex + 1, charIndex );
                    generics.push( CppDataType.fromString( currentGenericString ) );

                    currentGenericStartIndex = charIndex;

                    break;
                }

                // End of generic
                case ">": {
                    genericDepth--;
                    if( genericDepth === 0 ){
                        // This handles the final top-level generic which ends with '>'
                        const currentGenericString = dataTypeString.substring( currentGenericStartIndex + 1, charIndex );
                        generics.push( CppDataType.fromString( currentGenericString ) );
                    }
                    break;
                }

            }
        }

        // If no generics were found in the data type string, the entire string is the data type name
        if( currentGenericStartIndex === -1 ){
            dataTypeName = dataTypeString;
        }

        if( dataTypeName === undefined ){
            const errorString = `Failed to find data type name from '${dataTypeString}'`;
            console.error( errorString );
            throw Error( errorString );
        }

        return new CppDataType( dataTypeName, generics.length === 0 ? undefined : generics );
    }
}

class CppFunction {
    public constructor(
        Access: CppAccessType,
        IsVirtual: boolean = false,
        IsInline: boolean = false,
        Return: CppDataType = new CppDataType( "void" ),
        Name: string,
        Arguments: CppArgument[],
        IsConst: boolean = false
    ){}
}

class CppArgument {
    public constructor(
        public IsConst: boolean = false,
        public Name: string,
        public DataType: CppDataType
    ){}
}