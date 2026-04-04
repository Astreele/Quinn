import {
    ChatInputCommandInteraction,
    Message,
    User,
    GuildMember,
    Guild,
    TextBasedChannel,
    Client,
    Attachment,
    MessageFlags,
    MessageReplyOptions,
    InteractionReplyOptions,
    InteractionDeferReplyOptions
} from "discord.js";

export type ReplyContent = string | MessageReplyOptions | InteractionReplyOptions;

/**
 * A universal wrapper for Discord.js Message and ChatInputCommandInteraction objects.
 * This abstract class provides a common interface for executing commands via either method.
 */
export abstract class Context {
    /** Array of string arguments provided by the user (applicable mainly to prefix commands). */
    public args: string[];

    protected constructor(args: string[] = []) {
        this.args = args;
    }

    /** Gets the user who invoked the command. */
    abstract get author(): User;
    /** Gets the guild member who invoked the command, if applicable. */
    abstract get member(): GuildMember | null;
    /** Gets the guild (server) where the command was executed. */
    abstract get guild(): Guild | null;
    /** Gets the text channel where the command was executed. */
    abstract get channel(): TextBasedChannel | null;
    /** Gets the Discord bot client instance. */
    abstract get client(): Client;
    /** Gets the Unix timestamp of when the command was issued. */
    abstract get createdTimestamp(): number;

    protected preparePayload(content: ReplyContent, ephemeral?: boolean): any {
        const payload: any =
            typeof content === "string" ? { content } : { ...content };

        if (ephemeral !== undefined) {
            if (ephemeral) {
                payload.flags = MessageFlags.Ephemeral;
            } else if (payload.flags) {
                delete payload.flags; // Simplify flag handling across endpoints
            }
        }
        if ('ephemeral' in payload) {
            delete payload.ephemeral;
        }

        return payload;
    }

    /**
     * Sends a reply to the user. Abstraction automatically handles Interaction vs Message differences,
     * including automatic deferred interaction resolution and ephemeral flagging.
     * @param content The string or message payload to send.
     * @param options Object containing an ephemeral flag.
     * @returns A promise resolving to the sent Message object.
     */
    abstract reply(content: ReplyContent, options?: { ephemeral?: boolean }): Promise<Message>;
    
    /**
     * Edits the initial reply sent by the `reply` method.
     * @param content The new string or message payload.
     * @param options Object containing an ephemeral flag.
     * @returns A promise resolving to the edited Message object.
     * @throws {Error} If attempting to edit before sending an initial reply.
     */
    abstract editReply(content: ReplyContent, options?: { ephemeral?: boolean }): Promise<Message>;

    /**
     * Safely attempts to retrieve an attachment provided by the user.
     * @param optionName The name of the attachment option (relevant for slash commands). Defaults to "image".
     * @returns A promise resolving to the Attachment object, or null if none is found.
     */
    abstract getAttachment(optionName?: string): Promise<Attachment | null>;

    /**
     * Explicitly defer the response. Extremely useful when the command has to do 
     * heavy processing/fetching prior to the first reply. 
     * @param ephemeral Whether the deferral should be hidden (slash commands only).
     */
    abstract defer(ephemeral?: boolean): Promise<void>;

    /**
     * Parses a GuildMember from the arguments/options.
     * @param optionName The name of the option for slash commands.
     * @param argIndex The index of the argument for prefix commands. Defaults to 0.
     */
    abstract parseMember(optionName: string, argIndex?: number): Promise<GuildMember | null>;

    /**
     * Parses a User from the arguments/options.
     */
    abstract parseUser(optionName: string, argIndex?: number): Promise<User | null>;

    /**
     * Parses a Channel from the arguments/options.
     */
    abstract parseChannel(optionName: string, argIndex?: number): Promise<any | null>;

    /**
     * Parses a String from the arguments/options.
     * @param consumeRest For prefix commands: if true, slices from argIndex to the end.
     */
    abstract parseString(optionName: string, argIndex?: number, consumeRest?: boolean): string | null;

    /**
     * Parses an Integer from the arguments/options.
     */
    abstract parseInteger(optionName: string, argIndex?: number): number | null;
}

/**
 * Context subclass specifically for slash commands.
 */
export class CommandContext extends Context {
    public command: ChatInputCommandInteraction;
    private deferred = false;
    private replied = false;

    constructor(command: ChatInputCommandInteraction, args: string[] = []) {
        super(args);
        this.command = command;
    }

    get author(): User {
        return this.command.user;
    }

    get member(): GuildMember | null {
        return this.command.member as GuildMember | null;
    }

    get guild(): Guild | null {
        return this.command.guild;
    }

    get channel(): TextBasedChannel | null {
        return this.command.channel;
    }

    get client(): Client {
        return this.command.client;
    }

    get createdTimestamp(): number {
        return this.command.createdTimestamp;
    }

    async defer(ephemeral: boolean = false): Promise<void> {
        if (this.deferred || this.replied) return;

        const deferOptions: InteractionDeferReplyOptions = ephemeral
            ? { ephemeral: true }
            : {};
        await this.command.deferReply(deferOptions);
        this.deferred = true;
    }

    async reply(
        content: ReplyContent,
        options?: { ephemeral?: boolean }
    ): Promise<Message> {
        const isEphemeral = options?.ephemeral;

        await this.defer(isEphemeral);
        const payload = this.preparePayload(content, isEphemeral);

        if (!this.replied) {
            const msg = await this.command.editReply(payload);
            this.replied = true;
            return msg as Message;
        }
        return (await this.command.followUp(payload)) as Message;
    }

    async editReply(content: ReplyContent, options?: { ephemeral?: boolean }): Promise<Message> {
        if (!this.deferred && !this.replied)
            throw new Error("Cannot edit before reply/defer!");

        const payload = this.preparePayload(content, options?.ephemeral);

        return (await this.command.editReply(payload)) as Message;
    }

    async getAttachment(
        optionName: string = "image"
    ): Promise<Attachment | null> {
        return this.command.options.getAttachment(optionName) || null;
    }

    async parseMember(optionName: string, _argIndex?: number): Promise<GuildMember | null> {
        const member = this.command.options.getMember(optionName);
        return member as GuildMember | null;
    }

    async parseUser(optionName: string, _argIndex?: number): Promise<User | null> {
        return this.command.options.getUser(optionName);
    }

    async parseChannel(optionName: string, _argIndex?: number): Promise<any | null> {
        return this.command.options.getChannel(optionName);
    }

    parseString(optionName: string, _argIndex?: number, _consumeRest?: boolean): string | null {
        return this.command.options.getString(optionName);
    }

    parseInteger(optionName: string, _argIndex?: number): number | null {
        return this.command.options.getInteger(optionName);
    }
}

/**
 * Context subclass specifically for standard message (prefix) commands.
 */
export class MessageContext extends Context {
    public message: Message;
    private replyMsg?: Message;
    private replied = false;

    constructor(message: Message, args: string[] = []) {
        super(args);
        this.message = message;
    }

    get author(): User {
        return this.message.author;
    }

    get member(): GuildMember | null {
        return this.message.member;
    }

    get guild(): Guild | null {
        return this.message.guild;
    }

    get channel(): TextBasedChannel | null {
        return this.message.channel;
    }

    get client(): Client {
        return this.message.client;
    }

    get createdTimestamp(): number {
        return this.message.createdTimestamp;
    }

    async reply(
        content: ReplyContent,
        options?: { ephemeral?: boolean }
    ): Promise<Message> {
        const sent = await this.message.reply(
            this.preparePayload(content, options?.ephemeral)
        );
        this.replyMsg = sent;
        this.replied = true;
        return sent;
    }

    async editReply(content: ReplyContent, options?: { ephemeral?: boolean }): Promise<Message> {
        if (!this.replyMsg) throw new Error("You must reply() first!");
        return await this.replyMsg.edit(this.preparePayload(content, options?.ephemeral));
    }

    async getAttachment(
        _optionName: string = "image"
    ): Promise<Attachment | null> {
        const msg = this.message;

        if (msg.attachments.size > 0) {
            return msg.attachments.first() || null;
        }

        if (msg.reference?.messageId) {
            try {
                const ref = await msg.channel.messages.fetch(
                    msg.reference.messageId
                );
                return ref.attachments.first() || null;
            } catch {
                return null;
            }
        }

        return null;
    }

    async defer(_ephemeral?: boolean): Promise<void> {
        if (this.channel && "sendTyping" in this.channel) {
            await this.channel.sendTyping();
        }
    }

    async parseMember(_optionName: string, argIndex: number = 0): Promise<GuildMember | null> {
        if (!this.guild || !this.args[argIndex]) return null;
        const id = this.args[argIndex].replace(/[<@!>]/g, "");
        return await this.guild.members.fetch(id).catch(() => null);
    }

    async parseUser(_optionName: string, argIndex: number = 0): Promise<User | null> {
        if (!this.args[argIndex]) return null;
        const id = this.args[argIndex].replace(/[<@!>]/g, "");
        return await this.client.users.fetch(id).catch(() => null);
    }

    async parseChannel(_optionName: string, argIndex: number = 0): Promise<any | null> {
        if (!this.guild || !this.args[argIndex]) return null;
        const id = this.args[argIndex].replace(/[<#>]/g, "");
        return await this.guild.channels.fetch(id).catch(() => null);
    }

    parseString(_optionName: string, argIndex: number = 0, consumeRest: boolean = false): string | null {
        if (!this.args[argIndex]) return null;
        if (consumeRest) return this.args.slice(argIndex).join(" ");
        return this.args[argIndex];
    }

    parseInteger(_optionName: string, argIndex: number = 0): number | null {
        if (!this.args[argIndex]) return null;
        const parsed = parseInt(this.args[argIndex], 10);
        return isNaN(parsed) ? null : parsed;
    }
}
