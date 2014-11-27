extend      = require("xtend")
createError = require("errno").create
LevelErrors = require("levelup/lib/errors")

LevelUPError = LevelErrors.LevelUPError

SubkeyError = createError("LevelSubkeyError", LevelUPError)
RedirectError = createError("RedirectError", SubkeyError)
RedirectExceedError = createError("RedirectExceedError", RedirectError)
RedirectError::redirect = true
RedirectError::status = 300
RedirectExceedError::redirectExceed = true
RedirectExceedError::status = 301

module.exports = extend(LevelErrors,
  SubkeyError: SubkeyError
  RedirectError: RedirectError
  RedirectExceedError: RedirectExceedError
)
