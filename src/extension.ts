import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { CppScanner as CppScanner } from './file-scanner/cpp-scanner';
import { HeaderScanner } from './file-scanner/header-scanner';


export function activate( context: vscode.ExtensionContext ) {
    const config = vscode.workspace.getConfiguration( "renegade-toolkit" );
    
    // Set up scanners
    // CppScanner.initialize( context, config );
    // HeaderScanner.initialize( context, config );
    LuaScanner.initialize( context, config );

    // Set up things that use scanners
    LuaImportManager.initialize( context, config );
    LanguageSwitcher.initialize( context, config );

    // Start scanning
    // CppScanner.start();
    // HeaderScanner.start();
    LuaScanner.start();
}
