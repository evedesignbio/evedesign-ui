# evedesign-ui

## Scope

This repository contains the evedesign frontend application. 

A public instance of this application is available at https://evedesign.bio.

## Development and compilation

### Environment configuration

Set the following environment variables before development andbuilding:
```
export VITE_BACKEND_BASE_URL=<Your evedesign-server instance URL>
export VITE_SUPABASE_URL=<Your supabase URL>
export VITE_SUPABASE_ANON_KEY=<Your supabase public key>

# The following community servers are used for retrieving multiple sequence alignments
# and 3D structures. To avoid information leakage in private environments, you will
# need to host your own instance of these servers
export VITE_MMSEQS_BASE_URL=https://api.colabfold.com/
export VITE_FOLDSEEK_3DIPRED_BASE_URL=https://3di.foldseek.com/
export VITE_FOLDSEEK_BASE_URL=https://search.foldseek.com/
```

### Development

For development, use node version >= 22.

To install all dependencies:
```
npm install
```

To start the development server:
```
npm run dev
```

To build the application locally:
```
npm run build
```

## License

evedesign-ui is released under the APGLv3 license.

## Contact

For general questions or inquiries about *evedesign* please reach out to [hello@evedesign.bio](mailto:hello@evedesign.bio).