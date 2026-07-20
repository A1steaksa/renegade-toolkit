import * as vscode from 'vscode';
import { CppArgument } from "./cpp-argument";
import { CppDataType } from "./cpp-data-type";
import { TextUtils } from '../../utils/text-utils';
import { ErrorUtils } from '../../utils/error-utils';


export class CppFunction {   
    public constructor(
        public IsStatic: boolean = false,
        public IsVirtual: boolean = false,
        public IsInline: boolean = false,
        public isConstructor: boolean = false,
        public isDestructor: boolean = false,
        public Return: CppArgument = CppArgument.Void,
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

        let returnType: CppArgument|undefined;
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
                case "\n":
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

                        returnType = CppArgument.Void;

                    // We should have a return value on the token stack
                    }else{
                        functionName = tokens[1];

                        const returnTypeString = tokens[0];
                        returnType = CppArgument.fromString( returnTypeString );
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