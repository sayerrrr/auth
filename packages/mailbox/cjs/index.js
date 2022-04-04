"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
var _mailbox = _interopRequireWildcard(require("./mailbox"));
Object.keys(_mailbox).forEach(function(key) {
    if (key === "default" || key === "__esModule") return;
    if (key in exports && exports[key] === _mailbox[key]) return;
    Object.defineProperty(exports, key, {
        enumerable: true,
        get: function() {
            return _mailbox[key];
        }
    });
});
function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
        return obj;
    } else {
        var newObj = {};
        if (obj != null) {
            for(var key in obj){
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {};
                    if (desc.get || desc.set) {
                        Object.defineProperty(newObj, key, desc);
                    } else {
                        newObj[key] = obj[key];
                    }
                }
            }
        }
        newObj.default = obj;
        return newObj;
    }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgKiBmcm9tICcuL21haWxib3gnXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7K0NBQWMsV0FBVztBQUF6QixZQUFBLFFBQXlCOzsyQ0FBekIsUUFBeUI7Ozs7bUJBQXpCLFFBQXlCOzs7RUFBQSJ9