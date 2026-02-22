type PokemonSpritesPayload = {
  other?: {
    "official-artwork"?: {
      front_default?: string | null
    }
    home?: {
      front_default?: string | null
    }
  }
  front_default?: string | null
}

const POKEAPI_GRAPHQL_ENDPOINT = "https://graphql.pokeapi.co/v1beta2"

export async function fetchPokemonArtworkUrl(dexNumber: number): Promise<string | null> {
  if (!Number.isFinite(dexNumber) || dexNumber <= 0) {
    return null
  }

  const query = `
    query PokemonArtwork($id: Int!) {
      pokemon(where: { id: { _eq: $id } }, limit: 1) {
        pokemonsprites(limit: 1, order_by: { id: asc }) {
          sprites
        }
      }
    }
  `

  const response = await fetch(POKEAPI_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id: dexNumber } }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    data?: {
      pokemon?: Array<{
        pokemonsprites?: Array<{
          sprites?: PokemonSpritesPayload
        }>
      }>
    }
  }

  const sprites = payload.data?.pokemon?.[0]?.pokemonsprites?.[0]?.sprites
  if (!sprites) {
    return null
  }

  return (
    sprites.other?.["official-artwork"]?.front_default ??
    sprites.other?.home?.front_default ??
    sprites.front_default ??
    null
  )
}
