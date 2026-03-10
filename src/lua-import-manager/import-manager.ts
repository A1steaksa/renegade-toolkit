
import * as vscode from 'vscode';
import { Module } from '../module';
import { LuaImportableCache } from './importable-class-cache';
import { LuaImportAction } from './import-action';
import { LuaImportableClassScanner } from './importable-class-scanner';
import { LuaImportCompletion } from './import-completion';
import { TextUtils } from '../text-utils';
import { disconnect } from 'process';
import { LuaClass } from './importables/lua-class';
import { LuaEnum } from './importables/lua-enum';

export class LuaImportManager extends Module {

    private static importedClassNamePattern = /---\s*@type\s*([A-z0-9]+)/gm;
    private static importedEnumNamePattern = /=\s+[a-zA-Z0-9]+\.([A-Z_]+)/gm;

    public static override initialize( context: vscode.ExtensionContext ) {

        LuaImportableClassScanner.initialize( context );
        
        // Add our code action provider for adding a Lua import
        vscode.languages.registerCodeActionsProvider( [ "lua" ], new LuaImportAction() );

        vscode.languages.registerCompletionItemProvider( [ "lua" ], new LuaImportCompletion() );

        // Class import command
        const classImportDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.addClassImport",
            ( document: vscode.TextDocument, luaClass: LuaClass ) => {
                LuaImportManager.addClassImport( document, luaClass );
            }
        );

        // enum import command
        const enumImportDisposable = vscode.commands.registerCommand(
            "renegade-toolkit.addEnumImport",
            ( document: vscode.TextDocument, luaEnum: LuaEnum ) => {
                LuaImportManager.addEnumImport( document, luaEnum );
            }
        );

        context.subscriptions.push( classImportDisposable, enumImportDisposable );
    }

    public static getImportsRange( document: vscode.TextDocument ): vscode.Range {
        const range = TextUtils.getRegionContentRange( document, "Imports" );
        if( range === undefined ){
            throw new Error( "Imports region is missing from '" + document.uri.path + "'" );
        }
        return range;
    }

    public static getImportedEnumsRange( document: vscode.TextDocument ): vscode.Range {
        const range = TextUtils.getRegionContentRange( document, "Imported Enums" );
        if( range === undefined ){
            throw new Error( "Imported Enums region is missing from '" + document.uri.path + "'" );
        }
        return range;
    }

    /**
     * Replaces the class and enum imports for a given Lua class document with a set of classes and enums
     * @param importedClasses (Optional) Classes that the Lua class should import. Makes no change to imported classes if omitted.  
     * @param importedEnums (Optional) Enums that the Lua class should import.  Makes no change to imported enums if omitted.
     */
    public static updateImports( document: vscode.TextDocument, importedClasses: LuaClass[] | undefined, importedEnums: LuaEnum[] | undefined ){
        importedClasses = ( importedClasses === undefined ) ? this.getImportedClasses( document ) : importedClasses;
        importedEnums = ( importedEnums === undefined ) ? this.getImportedEnums( document ) : importedEnums;

        // Ensure that each enum's containing class is imported
        for( let enumIndex = 0; enumIndex < importedEnums.length; enumIndex++ ){
            const importedEnum = importedEnums[enumIndex];
            const enumParent = importedEnum.getContainingClass();

            let isClassAlreadyImported = false;
            for( let classIndex = 0; classIndex < importedClasses.length; classIndex++ ){
                const importedClass = importedClasses[classIndex];

                if( enumParent.equals( importedClass) ){
                    isClassAlreadyImported = true;
                    break;
                }
            }

            if( !isClassAlreadyImported ){
                importedClasses.push( enumParent );
            }
        }

        const importedClassesRange = this.getImportsRange( document );
        const importedEnumsRange = this.getImportedEnumsRange( document );

        const edit = new vscode.WorkspaceEdit();
        
        // Class imports
        const classImportsString = this.createClassImportsString( importedClasses );
        edit.replace( document.uri, importedClassesRange, classImportsString );

        // Enum imports
        const enumImportsString = this.createEnumImportsString( importedEnums );
        edit.replace( document.uri, importedEnumsRange, enumImportsString );

        vscode.workspace.applyEdit( edit );
    }

    public static addEnumImport( document: vscode.TextDocument, luaEnum: LuaEnum ) {
        const importedEnums = this.getImportedEnums( document );

        // Don't add an import if it's already been imported
        for( let index = 0; index < importedEnums.length; index++ ){
            const importedEnum = importedEnums[index];
            if( importedEnum.equals( luaEnum ) ){
                return;
            }
        }

        importedEnums.push( luaEnum );

        this.updateImports( document, undefined, importedEnums );
    }

    public static addClassImport( document: vscode.TextDocument, luaClass: LuaClass ) {
        const importedClasses = this.getImportedClasses( document );

        // Don't add an import if it's already been imported
        for( let index = 0; index < importedClasses.length; index++ ){
            const importedClass = importedClasses[index];
            if( importedClass.equals( luaClass ) ){
                return;
            }
        }

        importedClasses.push( luaClass );

        this.updateImports( document, importedClasses, undefined );
    }

    /** Creates an indented, multi-line sequence of import statements */
    public static createEnumImportsString( importableEnums: LuaEnum[] ) : string {
        let importsString = "\n";

        importableEnums.forEach( ( importableEnum, index ) => {
            importsString += importableEnum.getImportString();

            const isLastIndex = index === ( importableEnums.length - 1 );
            if( !isLastIndex ){
                importsString += "\n";
            }
        } );

        return importsString;
    }

    /** Creates an indented, multi-line sequence of import statements for a given array of LuaImportables */
    public static createClassImportsString( importableClasses: LuaClass[] ) : string {
        let importsString = "\n";

        importableClasses.forEach( ( importableClass, index ) => {
            importsString += importableClass.getImportString();

            const isLastIndex = index === ( importableClasses.length - 1 );
            if( !isLastIndex ){
                importsString += "\n\n";
            }

        } );

        return importsString;
    }

    public static doesDocumentImportEnum( document: vscode.TextDocument, luaEnum: LuaEnum ){
        const importedEnums = LuaImportManager.getImportedEnums( document );
        for (let index = 0; index < importedEnums.length; index++) {
            const importedEnum = importedEnums[index];
            if( luaEnum.equals( importedEnum ) ){
                return true;
            }
        }

        return false;
    }

    public static doesDocumentImportClass( document: vscode.TextDocument, luaClass: LuaClass ): boolean {
        const importedClasses = LuaImportManager.getImportedClasses( document );
        for( let index = 0; index < importedClasses.length; index++ ) {
            const importedClass = importedClasses[index];
            if( luaClass.equals( importedClass ) ){
                return true;
            }
        }

        return false;
    }

    /** Scans a given document and retrieves each imported enum */
    public static getImportedEnums( document: vscode.TextDocument ) : LuaEnum[] {
        const enumNames = this.getImportedEnumNames( document );

        let importableEnums: LuaEnum[] = [];

        for( let enumNameIndex = 0; enumNameIndex < enumNames.length; enumNameIndex++ ){
            const enumName = enumNames[enumNameIndex];
            const luaEnum = LuaImportableCache.getLuaEnumByName( enumName );
            if( luaEnum === undefined ){
                throw new Error( "The enum '" + enumName + "' does not exist in the import cache.  Is the enum name correct?" );
            }

            // Check for duplicates
            let isDuplicateEnum = false;
            for( let dupeCheckIndex = enumNameIndex - 1; dupeCheckIndex > 0; dupeCheckIndex-- ){
                const alreadyImportedEnum = importableEnums[dupeCheckIndex];
                if( alreadyImportedEnum.equals( luaEnum ) ){
                    isDuplicateEnum = true;
                    break;
                }
            }

            if( isDuplicateEnum ){
                continue;
            }

            importableEnums.push( luaEnum );
        }

        return importableEnums;
    }

    /** Scans a given document and retrieves each imported class */
    public static getImportedClasses( document: vscode.TextDocument ) : LuaClass[] {
        const classNames = this.getImportedClassNames( document );

        let importableClasses: LuaClass[] = [];

        for( let classNameIndex = 0; classNameIndex < classNames.length; classNameIndex++ ){
            const className = classNames[classNameIndex];
            const luaClass = LuaImportableCache.getLuaClassByName( className );
            if( luaClass === undefined ){
                throw new Error( "The class '" + className + "' does not exist in the import cache.  Is the enum name correct?" );
            }

            // Check for duplicates
            let isDuplicateClass = false;
            for( let dupeCheckIndex = classNameIndex - 1; dupeCheckIndex > 0; dupeCheckIndex-- ){
                const alreadyImportedClass = importableClasses[dupeCheckIndex];
                if( alreadyImportedClass.equals( luaClass ) ){
                    isDuplicateClass = true;
                    break;
                }
            }

            if( isDuplicateClass ){
                continue;
            }

            importableClasses.push( luaClass );
        }

        return importableClasses;
    }

    public static getImportedEnumNames( document: vscode.TextDocument ) : string[] {
        let enumNames: string[] = [];

        const importedEnumsString = document.getText( TextUtils.getRegionContentRange( document, "Imported Enums" ) );
        
        let match: RegExpExecArray | null = this.importedEnumNamePattern.exec( importedEnumsString );
        while( match !== null ){
            const enumName = TextUtils.underscoreCapitalsToCamelCase( match[1] );
            enumNames.push( enumName );

            match = this.importedEnumNamePattern.exec( importedEnumsString );
        }

        return enumNames;
    }

    /** Scans a given Lua document to find the classes that it imports */
    public static getImportedClassNames( document: vscode.TextDocument ) : string[] {
        let classNames: string[] = [];

        const importsString = document.getText( TextUtils.getRegionContentRange( document, "Imports" ) );

        let match: RegExpExecArray | null = this.importedClassNamePattern.exec( importsString );
        while( match !== null ){ 
            classNames.push( match[1] );

            match = this.importedClassNamePattern.exec( importsString );
        }

        return classNames;
    }
}