import * as vscode from 'vscode';
import { LanguageSwitcher } from './language-switcher/language-switcher';
import { LuaImportManager } from './lua-import-manager/import-manager';
import { LuaScanner } from './file-scanner/lua-scanner';
import { ClassTranslator } from './lua-class-creation/class-translator';
import { TerminalLinks } from './terminal-links/terminal-error-links';
import { CppClass } from './lua-class-creation/cpp-classes/cpp-class';
import { TextUtils } from './utils/text-utils';
import { FileUtils } from './utils/file-utils';
import { WindowUtils } from './utils/window-utils';
import { CppLexicalAnalyzer } from './lua-class-creation/cpp-lexical-analyzer';
import { Token, Tokens } from './lua-class-creation/cpp-tokens';
import { LuaClass } from './lua-class-creation/lua-classes/lua-class';

export const config = vscode.workspace.getConfiguration( "renegade-toolkit" );

export async function activate( context: vscode.ExtensionContext ) {
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
    await LuaScanner.start();
    // CppScanner.start();
    // HeaderScanner.start();

    runLexicalTest();
}

function runLexicalTest(){

    const file = FileUtils.relativeCppWorkspacePathToUri( "Code/Combat/backgroundmgr.h" );

    CppLexicalAnalyzer.read( file );
}

const fieldTests = [
    "float								Extent;",
    "unsigned							Hours, Minutes;",
    "CloudLayerClass			  *CloudLayer0;",
    "LightningClass				  *Lightning [LIGHTNING_COUNT];",
];

function runFieldTest(){

    for( let testIndex = 0; testIndex < fieldTests.length; testIndex++ ){
        const fieldTest = fieldTests[testIndex];
        
        

    }

}

const functionTests = [
    "HumanPhysClass(void);",
    "virtual ~HumanPhysClass(void);",
    "HumanPhysClass(const HumanPhysClass &);",
    // "virtual HumanPhysClass *	As_HumanPhysClass(void) { return this; }",
    // "void								Init(const HumanPhysDefClass & def);",
    // "void								Compute_Desired_Move_Vector(const GroundStateStruct & gs,float dt,Vector3 * set_move);",

    // `static float defaultValueTest( const int64 intArg1 = 100, const float floatArg1 = 1.0f, string stringArg1 = "Hello, world!" );`,

    // "static float   Get_Correction_Time    (void) { return _CorrectionTime; }",
    // "	WWINLINE Vector3(const float vector[3]) { X = vector[0]; Y = vector[1]; Z = vector[2]; }",
    // "bool Array_Test( const float vector[3], int unsizedArray[    ], bool multiDimensionalArray[][ 5 ], int64 namedSize[ something_in_here ] );",
    // "bool Apply_Move(const Vector3 & move ,float dt,bool allow_sliding= true,OuterGeneric <InnerGeneric1, InnerGeneric2 > allow_stepping = false,bool stop_on_walkable = false);"
    // "static virtual DynamicVectorClass<OuterGeneric <InnerGeneric1, InnerGeneric2 > >* Get_Sub_Titles     (const char* moviename, OuterGeneric <InnerGeneric1, InnerGeneric2 > genericArgName ) const  ; ",
    // "bool Apply_Move(const Vector3 & move,float dt,bool allow_sliding = true,bool allow_stepping = false,bool stop_on_walkable = false);",
];

const classDeclarationTests = [
    // Class
    // "class	ActionParamsStruct {",

    // Class with parent
    // "class Phys3Class : public MoveablePhysClass {",
    
    // Class with multiple parents
    // "class Phys3Class : public MoveablePhysClass, private Render2DClass {",
    
    // Class with template
    // "template<class T>\nclass DynamicVectorClass\n{",

    // Class with multiple templates
    // "template<class T, typename something>\nclass DynamicVectorClass\n{",
    
    // Class with template and parent
    "template<class T>\nclass DynamicVectorClass : public VectorClass<T>\n{",

    // Class with data type template
    // "template<int PRECISION> class Int {",

    // Class with generic data type template
    // "template< Vector<int, float> POS, int PRECISION> class Int {",
];

const classNameTests: { [cppName: string]: string; } = {
    "LogicalDecalClass" : "LogicalDecal",
    "MultiListObjectClass" : "MultiListObject",
    "PathMgrClass" : "PathManager",
    "HumanPhysClass" : "HumanPhysics",
    "Phys3Class" : "Physics3",
    "Phys3DClass" : "Physics3d",
    "Phys3DefClass" : "Physics3Definition",
    "Phys3DDefClass" : "Physics3dDefinition",
    "AABoxClass" : "AaBox",
    "AABTreeCullSystemClass" : "AabTreeCullSystem",
    "TCBSpline3DClass" : "TcbSpline3d",
};

function runClassNameTest(){
    for( let cppName in classNameTests ){
        const expectedResult = classNameTests[cppName];

        const actualResult = TextUtils.cppNameToLua( cppName );

        if( expectedResult === actualResult ){
            console.log( `Success: '${cppName}' -> '${actualResult}'` );
        }else{
            console.log( `Fail: '${cppName}' -> '${actualResult}', Expected: '${expectedResult}'` );
        }
    }
}

function runFileNameTest(){
    for( let cppName in classNameTests ){
        const luaClassName = classNameTests[cppName];

        const fileName = LuaClass.luaClassNameToFileName( luaClassName );

        console.log( `'${luaClassName}' -> '${fileName}'` );
    }
}


const dataTypeTests = [
    "Test"
];

function runDataTypeTest(){
    for( let key in dataTypeTests ){
        const cppDataTypeString = dataTypeTests[key];

        console.log( cppDataTypeString );
    }
}


const classTests: { ClassName: string, Path: string }[] = [
    { ClassName: "SkyClass", Path: "Code/Combat/backgroundmgr.h" }
];

export async function runClassTests(){

    for( let key in classTests ){
        const test = classTests[key];

        const file = FileUtils.relativeCppWorkspacePathToUri( test.Path );

        WindowUtils.showFile( file );
        const activeEditor = vscode.window.activeTextEditor;
        if( activeEditor === undefined ){
            console.warn( "No editor is active" );
            return;
        }

        const headerDocument = activeEditor.document;

        const result = await CppClass.read( headerDocument, test.ClassName );
        
        // console.log( result );
    }
}
