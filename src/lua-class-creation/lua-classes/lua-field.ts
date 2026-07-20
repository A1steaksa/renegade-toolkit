import { TextUtils } from "../../utils/text-utils";
import { CppField } from "../cpp-classes/cpp-field";
import { LuaDataType } from "./lua-data-type";

export class LuaField {
    private constructor(
        public Name: string,
        public DataType: LuaDataType
    ){}

    public static fromCpp( cppField: CppField ) : LuaField {
        let name = TextUtils.cppNameToLua( cppField.Name );
        let dataType = LuaDataType.fromCpp( cppField.DataType );
        return new LuaField( name, dataType );
    }
}