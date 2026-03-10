import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { LuaImportableClassScanner } from './lua-import-manager/importable-class-scanner';
import { LuaImportableCache } from './lua-import-manager/importable-class-cache';
import { TextUtils } from './text-utils';

export const config = vscode.workspace.getConfiguration( "renegade-toolkit" );

export function activate( context: vscode.ExtensionContext ) {
    
    // Set up scanners
    // CppScanner.initialize( context, config );
    // HeaderScanner.initialize( context, config );
    LuaScanner.initialize( context );

    // Set up things that use scanners
    LuaImportManager.initialize( context );
    LanguageSwitcher.initialize( context );

    const debugDisposable = vscode.commands.registerCommand( "renegade-toolkit.debug", () => {
        const document = vscode.window.activeTextEditor?.document;
        if( document === undefined ){
            return;
        }

        const importedEnums = LuaImportManager.getImportedEnums( document );
    } );
    context.subscriptions.push( debugDisposable );

    // Start scanning
    // CppScanner.start();
    // HeaderScanner.start();
    LuaScanner.start();
}
