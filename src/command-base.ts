import * as vscode from 'vscode';
import Handlebars from "handlebars";
import path from 'path';

export class CommandBase {

    /** The directory where template files should be, relative to the project's root */
    private static templateBasePath = "./templates";

    /**
     * The name of the template file within the template base path.  
     * This will be loaded automatically.
    */
    protected templateFileName = "";

    /**
     * The compiled template file for this command.  
     * This will be populated automatically.
     */
    private template: HandlebarsTemplateDelegate | undefined;

    /**
     * Run the user through this command's wizard and create a templated file based on their responses
     */
    async runCommand() {
        await this.loadTemplate();

        const wizardResult = await this.runWizard();

        // If the wizard had to exit prematurely we can't continue
        if( !wizardResult ) {
            vscode.window.showInformationMessage( "Wizard was aborted" );
            return;
        }

        const finalResult = await this.processWizardResult( wizardResult );

        this.createFileFromTemplate( wizardResult );
    }

    async runCommandSkipWizard( wizardResult: any ) {
        await this.loadTemplate();

        const finalResult = await this.processWizardResult( wizardResult );

        await this.createFileFromTemplate( wizardResult );
    }

    /**
     * Load this command's template file
     * @returns The loaded template or nothing if no workspace is open
     * */
    private async loadTemplate() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if( !workspaceFolders ) {
            vscode.window.showInformationMessage( "You must open a workspace before using a template wizard" );
            return;
        }

        const classTemplatePath = vscode.Uri.joinPath(
            workspaceFolders![0].uri,
            CommandBase.templateBasePath,
            this.templateFileName
        );

        const workspaceFs = vscode.workspace.fs;

        const classTemplateContents = ( await workspaceFs.readFile( classTemplatePath ) ).toString();
        this.template = Handlebars.compile( classTemplateContents );
    }

    /**
     * Prompt the user with whatever questions and inputs this command's template requires
     * @returns An object containing user responses or nothing if the wizard was exited prematurely
     */
    protected async runWizard(): Promise<Object | undefined> {
        // Replace this function in your command class
        return;
    }

    /**
     * Validates and processes the user's wizard inputs
     * @returns An object containing the user's responses and any values generated based on those responses, or nothing if the user's responses were invalid
     */
    protected async processWizardResult( result: any ): Promise<Object | undefined> {
        // Replace this function in your command class
        return;
    }

    /**
     * Use the provided params with the command's compiled template to generate a new file
     * @param params An object containing the key/values to be passed to the template
     */
    protected async createFileFromTemplate( params: any ) {
        if( !this.template ) { return; }

        // Generate the new file's contents using the provided params
        const output = this.template( params );

        // Determine the save location
        let fileToSaveTo: vscode.Uri;
        if( params.LuaSavePath === undefined ) {
            // Ask the user to select a save location
            const selectedFile = await vscode.window.showSaveDialog( {
                title: "Select or create file to save to",
                saveLabel: "Create File",
                filters: {
                    "Lua": ["lua"]
                }
            } );

            // Make sure they actually selected something
            if( !selectedFile ) {
                vscode.window.showInformationMessage( "Wizard was aborted" );
                return;
            }

            fileToSaveTo = vscode.Uri.from( { scheme: "file", path: selectedFile.path } );
        } else {

            const projectRootPath = vscode.workspace.workspaceFolders![0].uri.path;

            const relativeSavePath = params.LuaSavePath;
            
            const absoluteSavePath = path.resolve( projectRootPath, relativeSavePath );

            // Pull save location from the params if it's available
            fileToSaveTo = vscode.Uri.from( { scheme: "file", path: absoluteSavePath } );
        }

        console.log( "Saving to " + fileToSaveTo.path );

        

        vscode.workspace.fs.writeFile( fileToSaveTo, Buffer.from( output, "utf8" ) );
    }

    /**
     * Prompts the user to provide a text input
     * @param title The title shown above the input box
     * @param lowerText (Optional) The text to display below the input box
     * @param startingText (Optional) The text that will be present in the input box when the prompt is first shown
     * @param placeholderText (Optional) The text to show in the input box when no text is present
     * @param processingStep (Optional) A function to call as the final processing step.  It's return value will be returned by this function.
     * @returns Either the user's inputted text (after optional processing), or `undefined` if they aborted the prompt
     */
    static async getUserString(
        title: string,
        lowerText?: string,
        startingText?: string,
        placeholderText?: string,
        processingStep?: ( ( text: string ) => string ),
    ): Promise<string | undefined> {
        const rawInput = await vscode.window.showInputBox( {
            ignoreFocusOut: true,
            title: title,
            prompt: lowerText,
            value: startingText,
            placeHolder: placeholderText,
        } );

        if( rawInput === undefined ) {
            return undefined;
        }

        let input = rawInput;

        if( processingStep ) {
            input = processingStep( input );
        }

        return input;
    }

    /**
     * Prompts the user to provide a "Yes" or "No" answer
     * @param title The title shown above the input box
     * @param lowerText (Optional) The text to display below the input box
     * @param trueText (Optional) [Default: Yes] The label to put on the button corresponding to a `true` result
     * @param falseText (Optional) [Default: No] The label to put on the button corresponding to a `false` result
     * @returns `true` for "Yes", `false` for "No", and `undefined` if the prompt was aborted
     */
    static async getUserBoolean(
        title: string,
        lowerText?: string,
        trueText: string = "Yes",
        falseText: string = "No",
    ): Promise<boolean | undefined> {

        const rawChoice = await vscode.window.showQuickPick(
            [trueText, falseText],
            {
                ignoreFocusOut: true,
                title: title,
                placeHolder: lowerText
            }
        );

        if( rawChoice === trueText ) {
            return true;
        } else if( rawChoice === falseText ) {
            return false;
        } else {
            return undefined;
        }
    }


}