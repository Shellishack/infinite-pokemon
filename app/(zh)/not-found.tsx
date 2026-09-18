import type {Metadata} from 'next';
import Link from 'next/link';
import {zhCN} from '../content';

export const metadata:Metadata={title:zhCN.meta.notFound.title,description:zhCN.meta.notFound.description};

export default function NotFound(){
  return (
    <main className="container">
      <h1>{zhCN.notFound.heading}</h1>
      <p>{zhCN.notFound.body}</p>
      <p><Link className="btn" href="/zh-CN/">{zhCN.notFound.home}</Link></p>
    </main>
  );
}
