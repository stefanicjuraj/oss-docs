import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DOCS_PATH = path.join(__dirname, '../src/content/docs')
const SUBFOLDERS = ['about', 'configuration', 'installation', 'misc', 'usage', 'tools']
const EXCLUDE_FILES = ['404.md', 'index.mdx', 'api.mdx']

function processContent(content) {
  return content
    .split('\n')
    .filter(
      line =>
        !line.trim().startsWith('import') && !line.trim().startsWith('export')
    )
    .join('\n')
    .trim()
}

function extractSentence(text) {
  const match = text.match(/[^.!?]*[.!?]/)
  return match ? match[0].trim() : ''
}

function extractHyperlinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1')
}

function extractHeadings(content, slug) {
  const headingRegex = /^(#{1,6})\s+(.*)\n([^#]*)/gm
  let match
  const headings = []

  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[2].trim()
    const textBelow = match[3].trim()
    const description = extractHyperlinks(
      textBelow.split('\n')[0].trim() || extractSentence(textBelow)
    )
    const headingSlug = `${slug}#${heading
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}`
    headings.push({
      title: heading,
      description,
      tag: 'Documentation',
      url: `/docs${headingSlug}`,
      slug: headingSlug,
    })
  }

  return headings
}

function parseMarkdownFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const { content, data } = matter(fileContent)

  const cleanContent = processContent(content)

  const title = data.title || cleanContent.match(/^#\s+(.*)/)?.[1] || 'Untitled'
  const description = extractHyperlinks(extractSentence(cleanContent))
  const slug = filePath
    .replace(DOCS_PATH, '')
    .replace(/\\/g, '/')
    .replace(/\.mdx?$/, '')
  const headings = extractHeadings(cleanContent, slug)

  const mainData = {
    title,
    description,
    tag: 'Documentation',
    url: `/docs${slug}`,
    slug,
  }

  return [mainData, ...headings]
}

function searchDocs() {
  const results = []
  let objectID = 1

  function traverseDirectory(directory) {
    const files = fs.readdirSync(directory)

    files.forEach(file => {
      const fullPath = path.join(directory, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory() && SUBFOLDERS.includes(path.basename(fullPath))) {
        traverseDirectory(fullPath)
      } else if (
        stat.isFile() &&
        (file.endsWith('.md') || file.endsWith('.mdx')) &&
        !EXCLUDE_FILES.includes(file)
      ) {
        const fileData = parseMarkdownFile(fullPath)
        fileData.forEach(data => {
          results.push({
            ...data,
            objectID: objectID++,
          })
        })
      }
    })
  }

  traverseDirectory(DOCS_PATH)
  return results
}

function main() {
  const docsData = searchDocs()
  fs.writeFileSync(
    path.join(__dirname, 'search.json'),
    JSON.stringify(docsData, null, 2),
    'utf8'
  )
  console.log('search index updated')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}