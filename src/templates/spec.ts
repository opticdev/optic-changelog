// ## {{ name }} @ `/{{ specPath }}`
// ### {{ title }}

// [Click Here to See the Documentation]({{specUrl}})

// {{ content }}

export type SpecProps = {
  name: string
  specPath: string
  specUrl: string
  title: string
}

export function spec(
  {name, specPath, specUrl, title}: SpecProps,
  children?: string
): string {
  return `## ${name} @ \`/${specPath}\`
### ${title}

[Click Here to See the Documentation](${specUrl})

${children}`
}
