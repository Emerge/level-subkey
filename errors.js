var extend              = require('xtend')
var createError         = require('errno').create
  , LevelErrors         = require("levelup/lib/errors")
  , LevelUPError        = LevelErrors.LevelUPError
  , SubkeyError         = createError('LevelSubkeyError', LevelUPError)
  , RedirectError       = createError('RedirectError', SubkeyError)
  , RedirectExceedError = createError('RedirectExceedError', RedirectError)

RedirectError.prototype.redirect = true
RedirectError.prototype.status   = 300

RedirectExceedError.prototype.redirectExceed = true
RedirectExceedError.prototype.status   = 301

module.exports = extend(LevelErrors, {
    SubkeyError         : SubkeyError
  , RedirectError       : RedirectError
  , RedirectExceedError : RedirectExceedError
})
