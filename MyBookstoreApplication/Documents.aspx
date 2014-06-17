<%@ Page Title="Home Page" Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true"
    CodeBehind="Documents.aspx.cs" Inherits="MyBookstoreApplication._Documents" %>

<asp:Content ID="HeaderContent" runat="server" ContentPlaceHolderID="HeadContent">
</asp:Content>
<asp:Content ID="BodyContent" runat="server" ContentPlaceHolderID="MainContent">
    <h2>
        My Documents
    </h2>
    <p>
        Your documents are listed below. This page will refresh the status of converting documents every 5 seconds.<br />
        You can <a href="Documents.aspx">refresh</a> this page to see newly created documents.
    </p>
    <p>
        <asp:ScriptManager ID="ScriptManager1" runat="server">
        </asp:ScriptManager>
        <asp:UpdatePanel ID="UpdatePanel1" runat="server" UpdateMode="Conditional">
            <ContentTemplate>
                <asp:GridView ID="documentsGrid" runat="server" AllowPaging="true" AllowSorting="true"
                    AutoGenerateColumns="false" >
                    <HeaderStyle BackColor="AliceBlue" />
                    <Columns>
                        <asp:BoundField DataField="documentId" HeaderText="ID" />
                        <asp:BoundField DataField="name" HeaderText="Name" HtmlEncode="true" />
                        <asp:BoundField DataField="createdDate" HeaderText="Created" DataFormatString="{0:R}" />
                        <asp:TemplateField HeaderText="Shared">
                        <ItemStyle HorizontalAlign="Center" />
                        <ItemTemplate>
                            
                            <%# Eval("shareId") != DBNull.Value ? "True" : "False"%>
                        </ItemTemplate>
                        </asp:TemplateField>
                        <asp:TemplateField HeaderText="Conversion">
                        
                            <ItemStyle HorizontalAlign="Center" />
                            <ItemTemplate>
                                <%--<%# (Eval("convertedDate") == DBNull.Value ? "<img src='/Styles/ajax-loader.gif' />" : "Done")%>--%>
                                <%# Eval("xodState") %>
                            </ItemTemplate>
                        </asp:TemplateField>
                        <asp:BoundField DataField="convertedDate" HeaderText="Response Received" DataFormatString="{0:R}" />
                        <asp:TemplateField HeaderText="Preview">
                            <ItemStyle HorizontalAlign="Center" />
                            <ItemTemplate>
                                <%# (Eval("shareId") != DBNull.Value && Eval("thumbnailState").Equals("Ready") ? "<img border='1' class='thumbnail' src='http://api.pdftron.com/v2/download/" + Eval("shareId") + "?type=thumbnail'></img>" : "")%>
                                <%# Eval("thumbnailState").Equals("Queued") ? "<img src='/Styles/ajax-loader.gif' />" : ""%>
                            </ItemTemplate>
                        </asp:TemplateField>
                        <asp:TemplateField HeaderText="View">
                            <ItemStyle HorizontalAlign="Center" />
                            <ItemTemplate>
                                <%# (Eval("shareId") != DBNull.Value && Eval("xodState").Equals("Ready") ? 
                        "<a href='http://api.pdftron.com/v2/view/" + Eval("shareId") + "?v=silverlight' target='_new'>Silverlight4</a><br/>"  +
                        "<a href='http://api.pdftron.com/v2/view/" + Eval("shareId") + "?v=html5' target='_new'>HTML5</a>"
                        : "")%>
                            </ItemTemplate>
                        </asp:TemplateField>
                    </Columns>
                    <EmptyDataTemplate>
                        <div style="margin: 0 auto">
                            This page is empty. <a href="Upload.aspx">Upload</a> a new document now.
                        </div>
                    </EmptyDataTemplate>
                </asp:GridView>
                <asp:Timer runat="server" ID="UpdateTimer" Interval="500000" OnTick="UpdateTimer_Tick" />
            </ContentTemplate>
        </asp:UpdatePanel>
    </p>
    <div style="text-align: center; margin: 5px">
        <asp:LinkButton ID="PrevLinkButton" runat="server" OnClick="PrevLinkButton_Click">&lt;&lt;Prev</asp:LinkButton>
        <%= " (Page " + this.getPageInQueryString()  + ") " %>
        <asp:LinkButton ID="NextLinkButton" runat="server" OnClick="NextLinkButton_Click">Next&gt;&gt;</asp:LinkButton>
    </div>
</asp:Content>
