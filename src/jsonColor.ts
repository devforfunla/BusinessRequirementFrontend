export function colorizeJson(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(^[ \t]*)"([^"]+)":/gm, (_, space, key) => `${space}<span style="color:#a31515">"${key}"</span>:`)
    .replace(/: "([^"]*)"/g, (_, val) => ': <span style="color:#0451a5">"' + val + '"</span>')
    .replace(/: (-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span style="color:#098658">$1</span>')
    .replace(/: (true|false)/g, ': <span style="color:#0000ff">$1</span>')
    .replace(/: (null)/g, ': <span style="color:#0000ff">$1</span>')
    .replace(/([{,]\s*)"([^"]+)":/g, (_, pre, key) => `${pre}<span style="color:#a31515">"${key}"</span>:`)
    .replace(/(,|\[)\s*"([^"]*)"/g, (_, pre, val) => `${pre}<span style="color:#0451a5">"${val}"</span>`)
    .replace(/(,|\[)\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (_, pre, num) => `${pre}<span style="color:#098658">${num}</span>`)
}
