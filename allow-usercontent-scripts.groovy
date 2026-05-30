// Allow dashboard.js to run from userContent (Jenkins sandbox blocks scripts by default)
System.setProperty(
  "hudson.model.DirectoryBrowserSupport.CSP",
  "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:;"
)
println "userContent CSP updated - scripts allowed"
