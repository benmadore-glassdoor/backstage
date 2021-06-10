/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import sortSelector from './sortSelector';
import { ApiDoc, InterfaceInfo, MarkdownPrinter } from './types';

/**
 * The ApiDocPrinter takes a ApiDoc data structure, typically generated by an ApiDocGenerator,
 * and prints it out as a markdown doc with custom code highlighting and links.
 */
export default class ApiDocPrinter {
  printerFactory: () => MarkdownPrinter;

  constructor(printerFactory: () => MarkdownPrinter) {
    this.printerFactory = printerFactory;
  }

  /**
   * Print an index file with all ApiRefs and what types they implement.
   */
  printApiIndex(apiDocs: ApiDoc[]): Buffer {
    const printer = this.printerFactory();

    printer.header(1, 'Backstage Core Utility APIs');

    printer.paragraph(
      'The following is a list of all Utility APIs defined by `@backstage/core`.',
      'They are available to use by plugins and components, and can be accessed ',
      'using the `useApi` hook, also provided by `@backstage/core`.',
      'For more information, see https://github.com/backstage/backstage/blob/master/docs/api/utility-apis.md.',
    );

    for (const api of apiDocs) {
      printer.header(3, `${this.apiDisplayName(api)}`, api.id);

      printer.paragraph(api.description);

      const typeLinks = api.interfaceInfos.map(
        i => `[${i.name}](${printer.pageLink(i.name)})`,
      );
      printer.paragraph(
        `Implemented type${typeLinks.length > 1 ? 's' : ''}: ${typeLinks.join(
          ', ',
        )}`,
      );

      printer.paragraph(`ApiRef: ${printer.srcLink(api, api.name)}`);
    }

    return printer.toBuffer();
  }

  /**
   * Print documentation page for a type implemented by an ApiRef and
   */
  printInterface(apiType: InterfaceInfo, apiDocs: ApiDoc[]): Buffer {
    const printer = this.printerFactory();

    printer.header(1, apiType.name);

    printer.paragraph(
      `The ${apiType.name} type is defined at ${printer.srcLink(apiType)}.`,
    );

    const apiLinks = apiDocs
      .filter(ad => ad.interfaceInfos.some(i => i.name === apiType.name))
      .map(ad => {
        const link =
          printer.indexLink() +
          printer.headerLink(this.apiDisplayName(ad), ad.id);
        return `[${ad.name}](${link})`;
      });

    if (apiLinks.length === 1) {
      printer.paragraph(
        `The following Utility API implements this type: ${apiLinks}`,
      );
    } else {
      printer.paragraph(`The following Utility APIs implement this type:`);
      for (const link of apiLinks) {
        printer.text(`  - ${link}`);
      }
    }

    printer.header(2, 'Members');

    this.addInterfaceMembers(printer, apiType);

    if (apiType.dependentTypes.length) {
      printer.header(2, 'Supporting types');
      printer.paragraph(
        'These types are part of the API declaration, but may not be unique to this API.',
      );

      this.addInterfaceTypes(printer, apiType);
    }

    return printer.toBuffer();
  }

  private addInterfaceMembers(
    printer: MarkdownPrinter,
    apiType: InterfaceInfo,
  ) {
    for (const member of apiType.members) {
      printer.header(
        3,
        `${member.name}${member.type === 'method' ? '()' : ''}`,
        member.path,
      );

      for (const doc of member.docs) {
        printer.text(doc);
      }

      printer.code(member);
    }
  }

  private addInterfaceTypes(printer: MarkdownPrinter, apiType: InterfaceInfo) {
    for (const type of apiType.dependentTypes
      .slice()
      .sort(sortSelector(x => x.name))) {
      printer.header(3, `${type.name}`, type.path);

      for (const doc of type.docs) {
        printer.text(doc);
      }
      printer.code(type);

      printer.paragraph(`Defined at ${printer.srcLink(type)}.`);

      const usageLinks = [...apiType.members, ...apiType.dependentTypes]
        .filter(member => {
          return member.links.some(link => link.id === type.id);
        })
        .map(
          ({ name, path }) => `[${name}](${printer.headerLink(name, path)})`,
        );

      if (usageLinks.length) {
        printer.paragraph(`Referenced by: ${usageLinks.join(', ')}.`);
      }
    }
  }

  private apiDisplayName(api: ApiDoc): string {
    return api.name.replace(/ApiRef$/, '');
  }
}