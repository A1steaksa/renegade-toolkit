import * as vscode from 'vscode';
import { TextUtils } from '../utils/text-utils';
import { LuaClassDefinition } from './lua-class-definition';
import { LuaClass } from '../lua-import-manager/importables/lua-class';
import { LuaClassCreation } from './lua-class-creation';
import { WindowUtils } from '../utils/window-utils';

export enum CppAccessType { Public, Private, Protected }

export class CppClassDefinition {
    constructor(
        public name: string,
        public parents: CppClassParentDefinition[],
        public staticFields: CppFieldDefinition[],
        public staticFunctions: CppFunctionDefinition[],
        public instanceFields: CppFieldDefinition[],
        public instanceFunctions: CppFunctionDefinition[]
    ){}
}

export class CppClassParentDefinition {
    constructor( public accessType: CppAccessType, public name: string ){}
}

export class CppFieldDefinition {
    constructor( public isStatic: boolean = false, public name: string, public dataType: string, public defaultValue: string | undefined = undefined ) {}
}

export class CppFunctionDefinition {
    constructor( public isStatic: boolean, public isVirtual: boolean, public name: string, public args: CppArgumentDefinition[], public returnDataType: string | undefined ) {}
}

export class CppArgumentDefinition {
    constructor( public name: string, public dataType: string, public defaultValue: string | undefined = undefined ) {}
}

export class CppClassTranslator {

    public static async translateClass( document: vscode.TextDocument, className: string ) {
        // Get C++ class
        const cppClassDefinition = await this.createCppClassDefinition( document, className );
        if( cppClassDefinition === undefined ){
            throw new Error( `Unable to translate CPP class '${className}' to Lua.  Failed to create CPP class definition.` );
        }

        // Convert C++ class definition to Lua class definition
        const luaClassDefinition = LuaClassDefinition.fromCppClassDefinition( cppClassDefinition );

        // Save and display Lua class definition
        const createdClass = await LuaClassCreation.createClass( luaClassDefinition );
        WindowUtils.showFile( createdClass );
    }

    // #region | Definition Creation

    public static async createCppClassDefinition( document: vscode.TextDocument, className: string ) : Promise<CppClassDefinition | undefined> {
        const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand( "vscode.executeDocumentSymbolProvider", document.uri );
        if( symbols === undefined ) {
            console.warn( `Did not receive symbols from symbol provider for '${document.uri.path}'` );
            return;
        }

        const staticFields: CppFieldDefinition[] = [];
        const staticFunctions: CppFunctionDefinition[] = [];

        const instanceFields: CppFieldDefinition[] = [];
        const instanceFunctions: CppFunctionDefinition[] = [];

        // Find the class symbol
        let classSymbol: vscode.DocumentSymbol | undefined;
        for( let symbolIndex = 0; symbolIndex < symbols.length; symbolIndex++ ) {
            const symbol = symbols[symbolIndex];
            const symbolKind = symbol.kind as vscode.SymbolKind;

            // Make sure it's a class
            if( symbolKind !== vscode.SymbolKind.Class ) {
                continue;
            }

            // Make sure it's the right class
            if( symbol.name.toLowerCase() !== className.toLowerCase() ) {
                continue;
            }

            // Make sure it's not some kind of weird or malformed class without any contents
            const classChildren = symbol.children;
            if( classChildren === undefined ) {
                continue;
            }

            classSymbol = symbol;
            break;
        }
        if( classSymbol === undefined ){
            throw new Error( `Unable to find class '${className}' in '${document.fileName}'` );
        }

        // Parents
        const classText = document.getText( classSymbol.range );
        const parents: CppClassParentDefinition[] = this.createClassParentDefinitions( classText );

        // Extract all functions and fields from the symbol tree
        let functionSymbols = [];
        let fieldSymbols = [];
        const classChildren = classSymbol.children;
        for( let childIndex = 0; childIndex < classChildren.length; childIndex++ ) {
            const child = classChildren[childIndex];
            const childKind = child.kind as vscode.SymbolKind;
            switch( childKind ) {
                case vscode.SymbolKind.Method: {
                    functionSymbols.push( child );
                    break;
                }
                case vscode.SymbolKind.Field: {
                    fieldSymbols.push( child );
                    break;
                }
            }
        }

        // Sort functions and fields because the language server cannot be trusted to return them sorted
        functionSymbols = functionSymbols.sort( ( a, b ) => a.range.start.isBefore( b.range.start ) ? -1 : 1 );
        fieldSymbols = fieldSymbols.sort( ( a, b ) => a.range.start.isBefore( b.range.start ) ? -1 : 1 );

        // Create functions
        for (let funcIndex = 0; funcIndex < functionSymbols.length; funcIndex++) {
            const funcSymbol = functionSymbols[funcIndex];

            const functionName = document.getText( funcSymbol.selectionRange );
            const functionText = document.getText( funcSymbol.range );

            const cppFunctionDefinition = this.createCppFunctionDefinition( className, functionName, functionText );
            if( cppFunctionDefinition === undefined ) {
                console.warn( `Function definition is malformed for '${className}.${functionName}' and will be skipped` );
                continue;
            }

            if( cppFunctionDefinition.isStatic ) {
                staticFunctions.push( cppFunctionDefinition );
            } else {
                instanceFunctions.push( cppFunctionDefinition );
            }
        }

        // Create fields
        for (let fieldIndex = 0; fieldIndex < fieldSymbols.length; fieldIndex++) {
            const funcSymbol = fieldSymbols[fieldIndex];

            const fieldName = document.getText( funcSymbol.selectionRange );
            const fieldText = document.getText( funcSymbol.range );

            const cppFieldDefinition = this.createCppFieldDefinition( fieldText );
            if( cppFieldDefinition === undefined ) {
                console.warn( `Field definition is malformed for '${className}.${fieldName}' and will be skipped` );
                continue;
            }

            if( cppFieldDefinition.isStatic ) {
                staticFields.push( cppFieldDefinition );
            } else {
                instanceFields.push( cppFieldDefinition );
            }
        }

        return new CppClassDefinition( className, parents, staticFields, staticFunctions, instanceFields, instanceFunctions );
    }

    private static createClassParentDefinitions( classBody: string ) : CppClassParentDefinition[] {
        const classSignature = this.extractClassSignature( classBody );

        // Divides the class name from the parents
        const firstColonIndex = classSignature.indexOf( ":" );

        // No parents
        if( firstColonIndex === -1 ){
            return [];
        }

        let parentsText = classSignature.substring( firstColonIndex + 1 );
        parentsText = parentsText.trim();

        // Remove generic types
        // This might need to change later but I don't want to think about that right now so I'm not going to
        parentsText = TextUtils.removeGenerics( parentsText );

        // Remove spaces after commas
        parentsText = parentsText.replaceAll( ", ", "," );

        const parents: CppClassParentDefinition[] = [];

        const splitParents = parentsText.split( "," );
        for (let parentIndex = 0; parentIndex < splitParents.length; parentIndex++) {
            const parentText = splitParents[parentIndex];
            
            const spaceIndex = parentText.indexOf( " " );

            // Access type
            const accessTypeText = parentText.substring( 0, spaceIndex );
            let accessType: CppAccessType;
            switch( accessTypeText ){
                case "public": {
                    accessType = CppAccessType.Public;
                    break;
                }
                case "private": {
                    accessType = CppAccessType.Private;
                    break;
                }
                case "protected": {
                    accessType = CppAccessType.Protected;
                    break;
                }
                default: {
                    throw new Error( `Unknown access type '${accessTypeText}' found  in '${classSignature}'` );
                }
            }

            const parentName = parentText.substring( spaceIndex + 1 );
            
            parents.push( new CppClassParentDefinition( accessType, parentName ) );
        }

        return parents;
    }

    private static createCppFunctionDefinition( className: string, functionName: string, functionBody: string ): CppFunctionDefinition | undefined {
        let signature = this.extractFunctionSignature( functionBody );

        const isStatic = signature.startsWith( "static" );
        const isVirtual = signature.startsWith( "virtual" );
        const isConstructor = functionName === className;
        const isDestructor = functionName.startsWith( "~" );

        // Constructor/destructor name corrections
        if( isConstructor ){
            functionName = "Constructor";
        }else if( isDestructor ){
            functionName = "Destructor";
        }

        // Remove prefixes we already know about
        if( isStatic ) { signature = signature.substring( "static ".length ); }
        if( isVirtual ) { signature = signature.substring( "virtual ".length ); }

        // Find the return type
        let returnDataType: string | undefined;
        if( !isConstructor && !isDestructor ) {
            const spaceIndex = signature.indexOf( " " );
            const parenthesisIndex = signature.indexOf( "(" );
            if( spaceIndex === -1 || parenthesisIndex === -1 || spaceIndex > parenthesisIndex ) {
                console.warn( `Skipping ${className}.${functionName} as it doesn't appear to have a return type` );
                return;
            }
            returnDataType = signature.substring( 0, spaceIndex );
        }

        // Arguments
        const argsStartIndex = signature.indexOf( "(" ) + 1;
        const argsEndIndex = signature.indexOf( ")" );
        let argsText = signature.substring( argsStartIndex, argsEndIndex );

        const originalArgsText = argsText;

        // Remove pointer indicators
        argsText = argsText.replaceAll( /[&*]/g, "" );

        // Remove constant keywords
        argsText = argsText.replaceAll( "const ", "" );

        // Truncate whitespace to single spaces
        argsText = argsText.replaceAll( /\s{1,}/g, " " );

        // Remove whitespace around commas
        argsText = argsText.replaceAll( /\s?,\s?/g, "," );

        // Convert "DynamicVectorClass" generic types into arrays
        argsText = argsText.replaceAll( /DynamicVectorClass<(\w+)>/g, "$1[]" );

        // Deal with other generic types
        let genericStartIndex = argsText.indexOf( "<" );
        let genericEndIndex = argsText.indexOf( ">" );
        if( genericStartIndex !== -1 || genericEndIndex !== -1 ){
            console.warn( "UNHANDLED GENERIC ARGUMENT: " );
            console.warn( "Original: " + originalArgsText );
            console.warn( "CURRENT: " + argsText );
            throw new Error( "UNHANDLED GENERIC ARGUMENT: \n" + argsText );
        }

        // Create objects for each argument
        const args: CppArgumentDefinition[] = [];
        const splitArgs = argsText.split( "," );
        for( let argIndex = 0; argIndex < splitArgs.length; argIndex++ ) {
            let argText = splitArgs[argIndex];
            if( argText === "void" ) {
                break;
            }

            const argDataTypeIndex = argText.indexOf( " " );
            const argDataType = argText.substring( 0, argDataTypeIndex );

            // Remove the arg's data type
            argText = argText.substring( argDataTypeIndex + 1 );

            let argName: string;
            let defaultValue: string | undefined;

            const equalsIndex = argText.indexOf( "=" );
            const hasDefaultValue = equalsIndex !== -1;
            if( hasDefaultValue ) {
                argName = argText.substring( 0, equalsIndex ).trim();
                defaultValue = argText.substring( equalsIndex + 1 ).trim();
            } else {
                argName = argText;
            }

            args.push( new CppArgumentDefinition( argName, argDataType, defaultValue ) );
        }

        return new CppFunctionDefinition( isStatic, isVirtual, functionName, args, returnDataType );
    }

    public static createCppFieldDefinition( fieldText: string ): CppFieldDefinition {

        const isStatic = fieldText.startsWith( "static" );

        let fieldName: string = "";
        let fieldDataType: string = "";

        // C++ can declare a struct and a field of that struct's type at the same time
        // the format is: struct <name> { <struct fields> } <field name>;
        const isStructDeclarator = TextUtils.containsAll( fieldText, "struct", "{", "}" );
        if( isStructDeclarator ){
            // Get the name of the struct as the field's data type
            const structNameMatches = /struct\s+(\w+)/g.exec( fieldText );
            if( structNameMatches === undefined || structNameMatches!.length < 2 || structNameMatches === null ){
                throw new Error( `Unable to find struct name in field: ${fieldText}` );
            }
            fieldDataType = structNameMatches[1];

            // Get the name of the field that uses this struct as its data type
            const fieldNameMatches = /}\s+(\w+)/g.exec( fieldText );
            if( fieldNameMatches === undefined || fieldNameMatches!.length < 2 || fieldNameMatches === null ){
                throw new Error( `Unable to find field name in field: ${fieldText}` );
            }
            fieldName = fieldNameMatches[1];
        }else{
            // "Normal" field definitions whose format is:
            // <data type> <field name>;

            // Remove pointer indicators
            fieldText = fieldText.replaceAll( /[&*]/g, "" );

            // Remove ending semicolon
            fieldText = fieldText.substring( 0, fieldText.lastIndexOf( ";" ) );

            // Remove line breaks
            fieldText = fieldText.replaceAll( "\n", "" );

            // Truncate whitespace to single spaces
            fieldText = fieldText.replaceAll( /\s{1,}/g, " " );

            // Remove prefixes
            if( isStatic ) {
                fieldText = TextUtils.removeBeginnings( fieldText, ["static"] );
            }

            const lastSpaceIndex = fieldText.lastIndexOf( " " );
            fieldName = fieldText.substring( lastSpaceIndex );
        
            const arrayBracketIndex = fieldName.indexOf( "[" );
            const isArray = arrayBracketIndex !== -1;
            if( isArray ) {
                // TODO: probaby some kind of array-specific handling here
                fieldName = fieldName.substring( 0, arrayBracketIndex );
            }

            fieldDataType = fieldText.substring( 0, lastSpaceIndex );
        }

        fieldName = fieldName.trim();

        return new CppFieldDefinition( isStatic, fieldName, fieldDataType );
    }
    // #endregion


    // #region | String Extraction

    private static extractFunctionSignature( functionBody: string ): string {
        const braceIndex = functionBody.indexOf( "{" );

        let signatureEndIndex = braceIndex;
        const hasBody = braceIndex !== -1;
        if( !hasBody ) {
            const semicolonIndex = functionBody.indexOf( ";" );
            const hasSemicolon = semicolonIndex !== -1;
            if( !hasSemicolon ) {
                throw new Error( "The following function body does not appear to have a signature ending:\n```\n" + functionBody + "\n````" );
            }
            signatureEndIndex = semicolonIndex;
        }

        let signature = functionBody.substring( 0, signatureEndIndex );

        // Remove line breaks
        signature = signature.replaceAll( "\n", "" );

        // Truncate whitespace to single spaces
        signature = signature.replaceAll( /\s{1,}/g, " " );

        // Remove any spaces between function names and their opening parenthesis
        signature = signature.replaceAll( /\s+\(/g, "(" );

        // Remove spaces between function parenthesis and arguments
        signature = signature.replace( "( ", "(" );
        signature = signature.replace( " )", ")" );

        signature = signature.trim();

        return signature;
    }

    private static extractClassSignature( classBody: string ): string {
        const bracketIndex = classBody.indexOf( "{" );

        let signature = classBody.substring( 0, bracketIndex );

        // Remove line breaks
        signature = signature.replaceAll( "\n", "" );

        // Truncate whitespace to single spaces
        signature = signature.replaceAll( /\s{1,}/g, " " );

        return signature;
    }
    // #endregion
}