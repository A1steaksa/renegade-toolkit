import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { ClassTranslator } from './lua-class-creation/class-translator';
import { TerminalLinks } from './terminal-links/terminal-error-links';
import { CppClassDefinition, CppDataType, CppField } from './lua-class-creation/cpp-class-definition';
import { CppFieldDefinition } from './lua-class-creation/old/old_cpp-class-translator';

export const config = vscode.workspace.getConfiguration( "renegade-toolkit" );

export function activate( context: vscode.ExtensionContext ) {
    // Set up scanners
    // HeaderScanner.initialize( context );
    // CppScanner.initialize( context );
    LuaScanner.initialize( context );

    // Set up things that use scanners
    LuaImportManager.initialize( context );
    LanguageSwitcher.initialize( context );

    ClassTranslator.initialize( context );

    TerminalLinks.initialize( context );

    const debugDisposable = vscode.commands.registerCommand( "renegade-toolkit.debug", async () => {
        
    } );
    context.subscriptions.push( debugDisposable );

    // Start scanning
    LuaScanner.start();
    // CppScanner.start();
    // HeaderScanner.start();
}