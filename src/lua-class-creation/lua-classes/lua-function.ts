import { TextUtils } from "../../utils/text-utils";
import { CppFunction } from "../cpp-classes/cpp-function";
import { LuaField } from "./lua-field";

export class LuaFunction {
    private constructor(
        public Name: string,
        public Arguments: LuaField[],
        public Return: LuaField
    ){}

    public static fromCpp( cppFunc: CppFunction ): LuaFunction {
        const name = TextUtils.cppNameToLua( cppFunc.Name );

        const args: LuaField[] = [];

        let returns: LuaField = LuaField.fromCpp( cppFunc.Return );

        return new LuaFunction( name, args, returns );

    }

    private static 
}