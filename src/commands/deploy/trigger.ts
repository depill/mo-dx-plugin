import {core, flags, SfdxCommand} from '@salesforce/command';
import chalk from 'chalk';
import fs = require('fs-extra');
import {QueryResult} from '../../models/queryResult';
import {SobjectResult} from '../../models/sObjectResult';
import {Deploy, DeployResult} from '../../service/deploy';
import {getFileName} from '../../service/getFileName';
import {executeToolingQuery} from '../../service/toolingQuery';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('mo-dx-plugin', 'org');

export default class TriggerDeploy extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ $ sfdx deploy:trigger -p filepath'
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    classname: {type: 'string', required: false, char: 'n', description: 'name of the trigger' },
    filepath: {type: 'string', char: 'p', description: 'file path' }
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<core.AnyJson> {

    this.ux.startSpinner(chalk.bold.yellowBright('Saving ....'));

    interface ApexTrigger {
      Body: string;
      Name: string;
      TableEnumOrId: string;
    }

    const filebody = await fs.readFile(this.flags.filepath, 'utf8');
    const tableName = filebody.split(' ')[3];
    console.log(tableName);
    const conn = this.org.getConnection();
     // get the apex class Id using the class Name
    const triggerName = getFileName(this.flags.filepath, '.trigger');
    let query = 'Select Id from Apextrigger where Name=\'';
    query = query + triggerName + '\'';
    const apextrigger = await executeToolingQuery(query, conn) as QueryResult;
    // logic to update apex class
    if (apextrigger.records.length > 0) {
      const triggerId = apextrigger.records[0].Id ;
      const deployAction = new Deploy('TriggerContainer', 'ApexTriggerMember' , triggerId , filebody, conn);
      const deployResult = await deployAction.deployMetadata() as DeployResult;
      if (deployResult.success) {
        this.ux.stopSpinner(chalk.bold.greenBright('Trigger Successfully Updated'));
        return '';
      } else {
        this.ux.stopSpinner(chalk.bold.redBright('Trigger Update Failed'));
        if ( typeof deployResult.error !== 'undefined' ) {
          console.log(chalk.bold.redBright(deployResult.error));
        }
      }
    } else {
        // logic to create an apex class
          // Create Container AsyncRequest Object
        const apexTrigger = {
          Name: triggerName,
          Body: filebody,
          TableEnumOrId: tableName
        } as ApexTrigger;

        const apexSaveResult = await conn.tooling.sobject('ApexTrigger').create(apexTrigger) as SobjectResult;
        if ( apexSaveResult.success) {
          this.ux.stopSpinner(chalk.bold.green('Trigger Successfully Created'));
          return '';
        } else {
          for (const error of apexSaveResult.errors) {
            console.log(chalk.redBright(error));
          }
          this.ux.stopSpinner(chalk.bold.red('Trigger Creation Failed'));
        }
      }
    }
}
