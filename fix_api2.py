import re

filepath = 'src/lib/serverApi.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("""const getHeaders = () => {
  const token = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SERVER_API_TOKEN) || 'ayandeh-secret-token-1405';
  return {
    'Content-Type': 'application/json',
    'x-api-token': token,
  };
};
};""", """const getHeaders = () => {
  const token = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SERVER_API_TOKEN) || 'ayandeh-secret-token-1405';
  return {
    'Content-Type': 'application/json',
    'x-api-token': token,
  };
};""")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
