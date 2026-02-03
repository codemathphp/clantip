import PreloadCallbackClient from './PreloadCallbackClient'

type Props = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const reference = Array.isArray(params?.reference) ? params?.reference[0] : params?.reference
  return <PreloadCallbackClient reference={reference ?? null} />
}
