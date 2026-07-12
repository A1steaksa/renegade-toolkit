import * as vscode from 'vscode';
import { TextUtils } from '../utils/text-utils';
import { ErrorUtils } from '../utils/error-utils';

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
        const cppFunctions = CppFunction.fromSymbols( headerDocument, childSymbolLists.FunctionSymbols );
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

    public static Void = new CppDataType( "void" );

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

export class CppFunction {   
    public constructor(
        public IsStatic: boolean = false,
        public IsVirtual: boolean = false,
        public IsInline: boolean = false,
        public isConstructor: boolean = false,
        public isDestructor: boolean = false,
        public Return: CppDataType = CppDataType.Void,
        public Name: string,
        public Arguments: CppArgument[],
        public IsConst: boolean = false
    ){}

    public static fromSymbols( headerDocument: vscode.TextDocument, fields: vscode.DocumentSymbol[] ): CppFunction[] {
        const cppFunctions: CppFunction[] = [];

        for( let functionIndex = 0; functionIndex < fields.length; functionIndex++ ){
            const functionSymbol = fields[functionIndex];
            const functionText = headerDocument.getText( functionSymbol.range );
            cppFunctions.push( this.fromString( functionText ) );
        }

        return cppFunctions;
    }

    public static fromString( functionString: string ): CppFunction {

        let isStatic = false;
        let isVirtual = false;
        let isInline = false;
        let isConstructor = false;
        let isDestructor = false;
        let isConst = false;

        let returnType: CppDataType|undefined;
        let functionName: string|undefined;
        let args: CppArgument[] = [];

        // Get rid of pointer syntax
        functionString = functionString.replace( "*", "" ).trim();
        functionString = functionString.replace( "&", "" ).trim();

        // For our purposes here we don't need the body of the function if one is provided
        const bodyStartIndex = functionString.indexOf( "{" );
        if( bodyStartIndex !== -1 ){
            functionString = functionString.substring( 0, bodyStartIndex ).trim();
        }

        // Remove any trailing semicolon(s)
        functionString = TextUtils.removeEnding( functionString, ";" ).trim();

        let tokens: string[] = [];
        let currentToken = "";

        // State tracking
        let inArguments = false; // Are we in the arguments portion of the function declaration?
        let inString = false; // Are we within a string literal?
        let genericDepth = 0; // How many '<' have we seen that haven't yet had a matching '>'?
        let isEscaping = false; // Did we just see a '\'?

        for( let charIndex = 0; charIndex < functionString.length; charIndex++ ){
            const char = functionString[charIndex];
            
            switch( char ){

                // Whitespace
                case "\t":
                case " ": {
                    // Whitespace in arguments is just part of the token
                    if( inArguments ){
                        currentToken += char;
                        break;
                    }

                    // Check if the current token is a keyword
                    switch( currentToken ){
                        case "static": {
                            isStatic = true;
                            currentToken = "";
                            break;
                        }

                        case "WWINLINE":
                        case "inline": {
                            isInline = true;
                            currentToken = "";
                            break;
                        }

                        case "virtual": {
                            isVirtual = true;
                            currentToken = "";
                            break;
                        }

                        case "const": {
                            isConst = true;
                            currentToken = "";
                            break;
                        }

                        default: {
                            // During generics and arguments, treat spaces as just part of the token
                            if( genericDepth !== 0 || inArguments ){
                                currentToken += char;
                                break;
                            }
                            
                            // Whitespace is a keyword separator if there's a token in progress
                            currentToken = currentToken.trim();
                            if( currentToken.length !== 0 ){
                                tokens.push( currentToken );
                                currentToken = "";
                            }
                        }
                    }
                    break;
                }

                // Escape character
                case "\\": {

                    // We might be escaping an escape character
                    if( isEscaping ){
                        // Escaping an escape character only makes sense inside of strings
                        if( inString ){
                            currentToken += char;
                            break;
                        }

                        ErrorUtils.unexpectedChar( char, charIndex, functionString );
                    }else{
                        isEscaping = true;
                    }

                    break;
                }

                case "\"": {

                    if( inString ){

                        // Escape characters let us treat '"' within strings as part of the token
                        if( isEscaping ){
                            currentToken += char;
                            break;
                        }

                        inString = false;
                    }else{
                        inString = true;
                    }

                }

                // Generic start
                case "<": {

                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth++;
                    currentToken += char;
                    break;
                }

                // Generic end
                case ">": {

                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth--;
                    currentToken += char;
                    break;
                }

                // Argument or generic separator
                case ",": {

                    // Generics are sepearated by commas and are treated like a single, long token
                    // Default argument values can be strings which contain commas
                    if( genericDepth !== 0 || inString ){
                        currentToken += char;
                        break;
                    }
                    
                    // Each argument is a single long token separated by commas
                    if( inArguments ){

                        const cppArgument = CppArgument.fromString( currentToken );
                        // The argument might have been void
                        if( cppArgument !== undefined ){
                            args.push( cppArgument );
                        }
                        
                        currentToken = "";

                        break;
                    }

                    // I don't know if there's a legitimate place for a comma in function declarations outside of the above cases
                    ErrorUtils.unexpectedChar( char, charIndex, functionString );

                    break;
                }

                // The start of the function's arguments
                case "(": {
                    if( inArguments ){
                        ErrorUtils.unexpectedChar( char, charIndex, functionString );
                    }

                    inArguments = true;

                    // The function name might be in the current token so just put it on the token stack
                    // so the following code knows where it is
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                    }

                    // Only one token means no return value
                    // No return value means either a constructor or a malformed function
                    if( tokens.length === 1 ){
                        functionName = tokens[0];

                        // Destructors are identical to constructors but with a '~' prefix to their name
                        if( functionName.startsWith( "~" ) ){
                            isDestructor = true;
                        }else{
                            isConstructor = true;
                        }

                        returnType = CppDataType.Void;

                    // We should have a return value on the token stack
                    }else{
                        functionName = tokens[1];

                        const returnTypeString = tokens[0];
                        returnType = CppDataType.fromString( returnTypeString );
                    }


                    // // The token prior to the function name is always the return type
                    // const returnTypeString = tokens[tokens.length - 1];
                    // returnType = CppDataType.fromString( returnTypeString );
                    
                    break;
                }

                // The end of the function's arguments
                case ")": {
                    if( !inArguments ){
                        ErrorUtils.unexpectedChar( char, charIndex, functionString );
                    }

                    currentToken = currentToken.trim();
                    
                    // There may not be any arguments
                    if( currentToken.length === 0 ){
                        break;
                    }

                    // The final argument should be the current token
                    const cppArgument = CppArgument.fromString( currentToken );

                    // The argument might have been void
                    if( cppArgument !== undefined ){
                        args.push( cppArgument );
                    }

                    currentToken = "";

                    inArguments = false;
                    break;
                }

                default: {
                    currentToken += char;
                    break;
                }
            }
        }

        // The final part of the function declaration might be the "const" keyword
        if( currentToken === "const" ){
            isConst = true;
            currentToken = "";
        }

        if( functionName === undefined ){
            const errorMessage = `Unable to determine function name from '${functionString}'`;
            console.error( errorMessage );
            throw Error( errorMessage );
        }

        return new CppFunction( isStatic, isVirtual, isInline, isConstructor, isDestructor, returnType, functionName, args, isConst );
    }
}

class CppArgument {

    public constructor(
        public IsConst: boolean = false,
        public Name: string,
        public DataType: CppDataType,
        public ArrayDepth: number = 0,
        public Default: string|undefined,
    ){}

    /**
     * @param argString 
     * @return Either an argument or undefined if the argument was void
     */
    public static fromString( argString: string ): CppArgument|undefined {
        // Handle void early
        if( argString === "void" ){
            return;
        }

        argString = argString.trim();
        
        let isConst = false;
        let argName: string|undefined;
        let dataType: CppDataType|undefined;
        let arrayDepth: number|undefined;
        let defaultValue: string|undefined;

        let tokens: string[] = [];
        let currentToken = "";

        // State tracking
        let genericDepth = 0; // How many '<' have we seen that haven't yet had a matching '>'?
        let inString = false; // Have we seen a '"' but haven't yet seen a second '"'?
        let inArray = false; // Have we seen a '[' but haven't yet seen a ']'?
        let hasDefault = false;

        for( let charIndex = 0; charIndex < argString.length; charIndex++ ){
            const char = argString[charIndex];

            switch( char ){
                
                case " ": {
                    // Strings can contain ' '
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    // Spaces in generics are just part of their token
                    if( genericDepth !== 0 ){
                        currentToken += char;
                        break;
                    }

                    if( currentToken === "const" ){
                        isConst = true;
                        currentToken = "";
                        break;
                    }

                    // By default spaces are token separators
                    currentToken = currentToken.trim();
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                        break;
                    }

                    break;
                }

                case "\"": {

                    if( inString ){
                        inString = false;

                        tokens.push( currentToken );
                        currentToken = "";
                    }else{
                        inString = true;
                    }

                    break;
                }

                case "<": {
                    // Strings can contain '<'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth++;
                    currentToken += char;
                    break;
                }

                case ">": {
                    // Strings can contain '>'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    genericDepth--;
                    currentToken += char;
                    break;
                }

                case "[": {
                    // Strings can contain '['
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    inArray = true;

                    if( arrayDepth === undefined ){
                        arrayDepth = 1;
                    }else{
                        arrayDepth++;
                    }

                    // The first array syntax always comes right after the argument name
                    if( arrayDepth === 1 ){
                        currentToken = currentToken.trim();
                        if( currentToken.length === 0 ){
                            argName = tokens[tokens.length - 1];
                            
                            const dataTypeString = tokens[tokens.length - 2];
                            dataType = CppDataType.fromString( dataTypeString );
                        }else{
                            argName = currentToken;
                            currentToken = "";
    
                            const dataTypeString = tokens[tokens.length - 1];
                            dataType = CppDataType.fromString( dataTypeString );
                        }
                    }


                    break;
                }

                case "]": {
                    // Strings can contain ']'
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    if( !inArray ){
                        ErrorUtils.unexpectedChar( char, charIndex, argString );
                    }

                    inArray = false;

                    break;
                }

                case "=": {
                    // Strings can contain '='
                    if( inString ){
                        currentToken += char;
                        break;
                    }

                    if( hasDefault ){
                        ErrorUtils.unexpectedChar( char, charIndex, argString );
                    }
                    
                    // If there's a token in progress, it's the parameter name
                    currentToken = currentToken.trim();
                    if( currentToken.length !== 0 ){
                        tokens.push( currentToken );
                        currentToken = "";
                        break;
                    }

                    // Outside of string literals, '=' only appears when defining a default value for an optional argument
                    hasDefault = true;
                    break;
                }

                default: {
                    currentToken += char;
                }
            }
        }

        // The last token won't be on the tokens stack if there wasn't whitespace after it
        currentToken = currentToken.trim();
        if( currentToken.length !== 0 ){
            tokens.push( currentToken );
            currentToken = "";
        }

        // If nothing in the declaration already told us the name and data type,
        // we can infer their positions in the token stack
        if( argName === undefined && dataType === undefined ){
            if( hasDefault ){
                defaultValue = tokens[tokens.length - 1];
                argName = tokens[tokens.length - 2];
    
                const dataTypeString = tokens[tokens.length - 3];
                dataType = CppDataType.fromString( dataTypeString );
    
            }else{

                // Arguments might not have names when they're required by an interface but aren't actually used
                if( tokens.length === 1 ){
                    // Pretend this argument doesn't exist
                    return undefined;
                }
                
                argName = tokens[tokens.length - 1];
                const dataTypeString = tokens[tokens.length - 2];
                dataType = CppDataType.fromString( dataTypeString );
            }
        }


        if( argName === undefined ){
            ErrorUtils.error( `Unable to determine argument name from '${argString}'` );
        }

        if( dataType === undefined ){
            ErrorUtils.error( `Unable to determine argument data type from '${argString}'` );
        }

        return new CppArgument( isConst, argName, dataType, arrayDepth, defaultValue );
    }

}