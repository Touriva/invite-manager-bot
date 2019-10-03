import { Guild } from 'eris';

import { IMClient } from '../../client';
import { CommandUsage } from '../../models/CommandUsage';
import { Incident } from '../../models/Incident';
import { Log } from '../../models/Log';
import { BasicUser } from '../../types';

export class DBQueueService {
	private client: IMClient = null;

	private guilds: Set<Guild> = new Set();
	private doneGuilds: Set<String> = new Set();

	private users: Set<BasicUser> = new Set();
	private doneUsers: Set<String> = new Set();

	private logActions: Partial<Log>[] = [];
	private cmdUsages: Partial<CommandUsage>[] = [];
	private incidents: Partial<Incident>[] = [];

	public constructor(client: IMClient) {
		this.client = client;

		setInterval(() => this.syncDB(), 10000);
	}

	public addLogAction(action: Partial<Log>, guild: Guild, user: BasicUser) {
		if (!this.doneGuilds.has(guild.id)) {
			this.guilds.add(guild);
		}

		if (!this.doneUsers.has(user.id)) {
			this.users.add(user);
		}

		this.logActions.push(action);
	}

	public addCommandUsage(cmdUsage: Partial<CommandUsage>, guild: Guild, user: BasicUser) {
		if (!this.doneGuilds.has(guild.id)) {
			this.guilds.add(guild);
		}

		if (!this.doneUsers.has(user.id)) {
			this.users.add(user);
		}

		this.cmdUsages.push(cmdUsage);
	}

	public addIncident(incident: Partial<Incident>, guild: Guild) {
		if (!this.doneGuilds.has(guild.id)) {
			this.guilds.add(guild);
		}
		this.incidents.push(incident);
	}

	private async syncDB() {
		if (this.logActions.length === 0 && this.cmdUsages.length === 0 && this.incidents.length === 0) {
			return;
		}

		console.time('syncDB');

		const newGuilds = [...this.guilds.values()];
		this.guilds.clear();
		if (newGuilds.length > 0) {
			await this.client.repo.guild
				.createQueryBuilder()
				.insert()
				.values(
					newGuilds.map(guild => ({
						id: guild.id,
						name: guild.name,
						icon: guild.iconURL,
						memberCount: guild.memberCount
					}))
				)
				.orUpdate({ overwrite: ['name', 'icon', 'memberCount'] })
				.execute();
			newGuilds.forEach(g => this.doneGuilds.add(g.id));
		}

		const newUsers = [...this.users.values()];
		this.users.clear();
		if (newUsers.length > 0) {
			await this.client.repo.member
				.createQueryBuilder()
				.insert()
				.values(
					newUsers.map(user => ({
						id: user.id,
						name: user.username,
						discriminator: user.discriminator
					}))
				)
				.orUpdate({ overwrite: ['name', 'discriminator'] })
				.execute();
			newUsers.forEach(u => this.doneUsers.add(u.id));
		}

		const promises: Promise<any[]>[] = [];
		if (this.logActions.length > 0) {
			promises.push(this.client.repo.log.insert(this.logActions).then(() => (this.logActions = [])));
		}
		if (this.cmdUsages.length > 0) {
			promises.push(this.client.repo.commandUsage.insert(this.cmdUsages).then(() => (this.cmdUsages = [])));
		}
		if (this.incidents.length > 0) {
			promises.push(this.client.repo.incident.insert(this.incidents).then(() => (this.incidents = [])));
		}

		await Promise.all(promises);

		console.timeEnd('syncDB');
	}
}
