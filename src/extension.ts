import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { LuaImportableClassScanner } from './lua-import-manager/importable-class-scanner';
import { LuaImportableCache } from './lua-import-manager/importable-class-cache';
import { TextUtils } from './utils/text-utils';
import { LuaClass } from './lua-import-manager/importables/lua-class';
import { CodeGen } from './code-gen/code-gen';
import { LuaClassCreation } from './lua-class-creation/lua-class-creation';
import { CppScanner } from './file-scanner/cpp-scanner';
import { HeaderScanner } from './file-scanner/header-scanner';

export const config = vscode.workspace.getConfiguration( "renegade-toolkit" );

export function activate( context: vscode.ExtensionContext ) {
    
    // Set up scanners
    // HeaderScanner.initialize( context );
    // CppScanner.initialize( context );
    LuaScanner.initialize( context );

    // Set up things that use scanners
    LuaImportManager.initialize( context );
    LanguageSwitcher.initialize( context );

    LuaClassCreation.initialize( context );

    const debugDisposable = vscode.commands.registerCommand( "renegade-toolkit.debug", () => {
        const document = vscode.window.activeTextEditor?.document;
        if( document === undefined ){
            return;
        }

        console.log( vscode.workspace.asRelativePath( document.uri ) );

    } );
    context.subscriptions.push( debugDisposable );

    // Start scanning
    LuaScanner.start();
    // CppScanner.start();
    // HeaderScanner.start();
}
