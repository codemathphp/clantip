import PreloadCallbackClient from './PreloadCallbackClient'

type Props = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function Page({ searchParams }: Props) {
  const reference = Array.isArray(searchParams?.reference) ? searchParams?.reference[0] : searchParams?.reference
  return <PreloadCallbackClient reference={reference ?? null} />
}
