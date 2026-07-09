import * as vscode from 'vscode';
import { Module } from '../module';
import { WindowUtils } from '../utils/window-utils';
import { CppClassDefinition } from './cpp-class-definition';
import { JsonClassDefinition } from './json-class-definition';
import { CppClassCache } from './old/old_cpp-class-cache';

/**
 * Tools for converting C++ class headers into JSON class definitions,
 * then converting those JSON class definitions into Lua classes.
 */
export class ClassTranslator implements Module {
    
    public static initialize( context: vscode.ExtensionContext ){
        CppClassCache.initialize( context );

        context.subscriptions.push(
            vscode.commands.registerCommand( "renegade-toolkit.createJsonFromHeader", ClassTranslator.HeaderToJson )
        );
    }

    /**
     * Creates, saves, and opens a JSON class definition for the currently active text editor
     */
    private static async HeaderToJson(){
        const activeEditor = vscode.window.activeTextEditor;
        if( activeEditor === undefined ){
            console.warn( "No editor is active" );
            return;
        }

        const headerDocument = activeEditor.document;

        const documentLanguage = activeEditor.document.languageId;
        if( documentLanguage !== "cpp" ){
            console.warn( "Active document isn't C++" );
            return;
        }

        // Figure out which class to translate
        const className = await ClassTranslator.getClassNameToTranslate( headerDocument );
        if( className === undefined ){
            console.warn( "Unable to determine the class name to translate" );
            return;
        }
       
        // Create a CPP class definition from the header
        const cppClassDefinition = await CppClassDefinition.read( headerDocument, className );

        // Convert the CPP class definition into a JSON class definition
        const jsonClassDefinition = JsonClassDefinition.from( cppClassDefinition );

        // Save the JSON class definition
        const saveLocation = await jsonClassDefinition.write( undefined );

        // Open the JSON class definition
        WindowUtils.showFile( saveLocation );
    }

    /**
     * Determines the name of the class that the user wants to translate by just asking them
     */
    private static async getClassNameToTranslate( header: vscode.TextDocument ): Promise<string|undefined> {
        // Get a list of all class definitions within the header
        const classesInFile = CppClassCache.getClassesByUri( header.uri );
        if( classesInFile.length === 0 ){
            vscode.window.showErrorMessage( "There are no classes in this file!" );
            return;
        }

        // Ask the user which CPP class within the header file to translate
        let classToCreate: string | undefined;
        if( classesInFile.length === 1 ){
            // If there's only one class in the header file, don't bother prompting the user
            classToCreate = classesInFile[0].name;
        }else{
            // Create a list of class names within the file
            const classNames = [];
            for( let classIndex = 0; classIndex < classesInFile.length; classIndex++ ){
                const classOption = classesInFile[classIndex];
                classNames.push( classOption.name );
            }
    
            // Prompt the user to pick one of the class names
            classToCreate = await vscode.window.showQuickPick( classNames, { title: "Select Class to Translate", canPickMany: false, ignoreFocusOut: true } );
        }

        if( classToCreate === undefined ){
            vscode.window.showErrorMessage( "Canceling Class Translation" );
            return;
        }

        return classToCreate;
    }
}