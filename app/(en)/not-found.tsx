import type {Metadata} from 'next';
import Link from 'next/link';
import {en} from '../content';

export const metadata:Metadata={title:en.meta.notFound.title,description:en.meta.notFound.description};

export default function NotFound(){
  return (
    <main className="container">
      <h1>{en.notFound.heading}</h1>
      <p>{en.notFound.body}</p>
      <p><Link className="btn" href="/">{en.notFound.home}</Link></p>
    </main>
  );
}
