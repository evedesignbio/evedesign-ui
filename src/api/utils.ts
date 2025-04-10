// borrowed from https://hulk.mmseqs.com/mmirdit/scratch/requestmsa.mjs
export function convertToQueryUrl(obj: any) {
  let params = new URLSearchParams(obj);
  let entries = Object.entries(obj);

  for (let entry in entries) {
    let key = entries[entry][0];
    let value = entries[entry][1];

    if (Array.isArray(value)) {
      params.delete(key);
      value.forEach(function (v) {
        return params.append(key + "[]", v);
      });
    }
  }

  return params.toString();
}